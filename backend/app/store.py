from datetime import date
from time import monotonic
from uuid import UUID

from psycopg import Connection
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .models import CheckStatus, Progress, Report

HEALTH_CHECK_INTERVAL_SECONDS = 300


def check_connection(connection: Connection) -> None:
    now = monotonic()
    last_probe = getattr(connection, "_stalecheck_last_probe", now)
    if connection.closed or now - last_probe >= HEALTH_CHECK_INTERVAL_SECONDS:
        ConnectionPool.check_connection(connection)
        connection._stalecheck_last_probe = now


class PostgresStore:
    def __init__(self, database_url: str) -> None:
        if not database_url:
            raise RuntimeError("DATABASE_URL is not configured.")
        self.database_url = database_url
        self.pool = ConnectionPool(
            database_url,
            min_size=1,
            max_size=8,
            check=check_connection,
            kwargs={"row_factory": dict_row},
            open=True,
        )

    def create(
        self,
        check_id: str,
        user_id: UUID,
        owner_name: str,
        owner_email: str,
        title: str,
        doc_as_of: date,
    ) -> CheckStatus:
        status = CheckStatus(check_id=check_id, status="queued")
        with self.pool.connection() as connection:
            connection.execute(
                """INSERT INTO checks
                   (id, user_id, owner_name, owner_email, title, doc_as_of, status, progress, partial_claims)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    check_id,
                    user_id,
                    owner_name,
                    owner_email,
                    title,
                    doc_as_of,
                    status.status,
                    Jsonb(status.progress.model_dump(mode="json")),
                    Jsonb([]),
                ),
            )
        return status

    def get_status(self, check_id: str, user_id: UUID) -> CheckStatus | None:
        with self.pool.connection() as connection:
            row = connection.execute(
                "SELECT id, status, progress, partial_claims, error FROM checks WHERE id = %s AND user_id = %s",
                (check_id, user_id),
            ).fetchone()
        if row is None:
            return None
        return CheckStatus(
            check_id=row["id"],
            status=row["status"],
            progress=Progress.model_validate(row["progress"]),
            partial_claims=row["partial_claims"],
            error=row["error"],
        )

    def save_status(self, status: CheckStatus, user_id: UUID) -> None:
        with self.pool.connection() as connection:
            connection.execute(
                """UPDATE checks SET status = %s, progress = %s, partial_claims = %s,
                   error = %s, updated_at = now() WHERE id = %s AND user_id = %s""",
                (
                    status.status,
                    Jsonb(status.progress.model_dump(mode="json")),
                    Jsonb([claim.model_dump(mode="json") for claim in status.partial_claims]),
                    status.error,
                    status.check_id,
                    user_id,
                ),
            )

    def get_report(self, check_id: str, user_id: UUID) -> Report | None:
        with self.pool.connection() as connection:
            row = connection.execute(
                "SELECT report FROM checks WHERE id = %s AND user_id = %s",
                (check_id, user_id),
            ).fetchone()
        if row is None or row["report"] is None:
            return None
        return Report.model_validate(row["report"])

    def save_report(self, report: Report, user_id: UUID) -> None:
        with self.pool.connection() as connection:
            connection.execute(
                """UPDATE checks SET report = %s, document_text = %s, searches_used = %s,
                   updated_at = now() WHERE id = %s AND user_id = %s""",
                (
                    Jsonb(report.model_dump(mode="json")),
                    report.document_text,
                    report.searches_used,
                    report.check_id,
                    user_id,
                ),
            )

    def list_checks(self, user_id: UUID, limit: int = 30) -> list[dict[str, object]]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """SELECT id AS check_id, title, owner_name, doc_as_of::text, status, created_at,
                   COALESCE((report->>'freshness_score')::integer, 0) AS freshness_score,
                   jsonb_array_length(COALESCE(report->'claims', '[]'::jsonb)) AS claim_count
                   FROM checks WHERE user_id = %s ORDER BY created_at DESC LIMIT %s""",
                (user_id, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def retrieve_evidence(
        self,
        user_id: UUID,
        check_id: str,
        embedding: list[float],
        limit: int = 5,
    ) -> list[dict[str, object]]:
        vector = "[" + ",".join(str(value) for value in embedding) + "]"
        with self.pool.connection() as connection:
            rows = connection.execute(
                """SELECT content, source_url, metadata, 1 - (embedding <=> %s::vector) AS similarity
                   FROM evidence_chunks
                   WHERE user_id = %s AND check_id <> %s AND 1 - (embedding <=> %s::vector) >= 0.55
                   ORDER BY embedding <=> %s::vector LIMIT %s""",
                (vector, user_id, check_id, vector, vector, limit),
            ).fetchall()
        return [dict(row) for row in rows]

    def save_evidence(
        self,
        check_id: str,
        user_id: UUID,
        claim_id: str,
        records: list[tuple[str, str, dict[str, object], list[float]]],
    ) -> None:
        if not records:
            return
        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                parameters = [
                    (
                        check_id,
                        user_id,
                        claim_id,
                        content,
                        source_url,
                        Jsonb(metadata),
                        "[" + ",".join(str(value) for value in embedding) + "]",
                    )
                    for content, source_url, metadata, embedding in records
                ]
                cursor.executemany(
                    """INSERT INTO evidence_chunks
                       (check_id, user_id, claim_id, content, source_url, metadata, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s, %s::vector)
                       ON CONFLICT (check_id, claim_id, source_url) DO NOTHING""",
                    parameters,
                )