from datetime import date, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app import main, pipeline
from app.auth import AuthUser, get_current_user
from app.models import CheckStatus, Report

TEST_USER = AuthUser(id=UUID("10000000-0000-0000-0000-000000000001"), email="test@example.com", name="Test User")


class MemoryStore:
    def __init__(self) -> None:
        self.statuses: dict[str, CheckStatus] = {}
        self.reports: dict[str, Report] = {}

    def create(self, check_id, user_id, title, doc_as_of):
        status = CheckStatus(check_id=check_id, status="queued")
        self.statuses[check_id] = status
        return status

    def get_status(self, check_id, user_id):
        return self.statuses.get(check_id)

    def save_status(self, status):
        self.statuses[status.check_id] = status

    def get_report(self, check_id, user_id):
        return self.reports.get(check_id)

    def save_report(self, report):
        self.reports[report.check_id] = report

    def list_checks(self, user_id, limit=30):
        return []

    def retrieve_evidence(self, user_id, check_id, embedding, limit=5):
        return []

    def save_evidence(self, check_id, user_id, claim_id, records):
        return None


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(main, "store", MemoryStore())
    main.app.dependency_overrides[get_current_user] = lambda: TEST_USER
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


def test_unknown_check_returns_not_found(client: TestClient) -> None:
    response = client.get("/api/checks/not-a-real-check")

    assert response.status_code == 404


def test_check_routes_require_authentication() -> None:
    with TestClient(main.app) as test_client:
        assert test_client.get("/api/checks").status_code == 401


@pytest.mark.parametrize(
    ("data", "expected_detail"),
    [
        ({"doc_as_of": "2024-01-01"}, "Provide exactly one PDF file or text document."),
        (
            {"doc_as_of": (date.today() + timedelta(days=1)).isoformat(), "text": "A dated fact."},
            "doc_as_of cannot be in the future.",
        ),
    ],
)
def test_create_check_validates_input(client: TestClient, data: dict[str, str], expected_detail: str) -> None:
    response = client.post("/api/checks", data=data)

    assert response.status_code == 422
    assert response.json()["detail"] == expected_detail


def test_real_check_reports_missing_gemini_configuration(
    client: TestClient,
    monkeypatch,
) -> None:
    monkeypatch.setattr(pipeline.config, "GEMINI_API_KEY", None)

    created = client.post(
        "/api/checks",
        data={"text": "The population was 10 million in 2020.", "doc_as_of": "2020-01-01"},
    )

    assert created.status_code == 202
    check_id = created.json()["check_id"]
    check = client.get(f"/api/checks/{check_id}").json()
    assert check["status"] == "failed"
    assert check["error"] == "GEMINI_API_KEY is not configured."
    assert client.get(f"/api/checks/{check_id}/report").status_code == 409