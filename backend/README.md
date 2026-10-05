# StaleCheck API

FastAPI backend for the StaleCheck frontend. It extracts claims with Gemini, searches Google, Google News, and Google Scholar through SerpAPI, verifies each claim, and persists user-owned jobs and reports in Neon Postgres.

Relevant prior evidence is embedded with `gemini-embedding-001`, stored as `vector(768)`, and retrieved with cosine similarity. It supplements current search context; live evidence remains authoritative for verdicts.

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set these values in `.env`:

- `SERPAPI_API_KEY` and `GEMINI_API_KEY`
- `DATABASE_URL` for the Neon database containing `checks` and `evidence_chunks`
- `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`
- `GEMINI_EMBEDDING_MODEL` (defaults to `gemini-embedding-001`)

All checks use live providers. No sample report or fallback evidence is generated.

## Run

```bash
uvicorn app.main:app --reload --port 8001
```

The API is available at `http://localhost:8001`, with interactive documentation at `http://localhost:8001/docs`.

## Test

```bash
pytest -q
```

## Endpoints

- `GET /api/checks` returns the current user's check history.
- `POST /api/checks` accepts multipart `file` (PDF) or `text`, plus `title` and `doc_as_of`.
- `GET /api/checks/{check_id}` returns polling status and partial claims.
- `GET /api/checks/{check_id}/report` returns the completed report.
- `GET /health` returns service health.

Every `/api/checks` route requires a Neon Auth bearer token. Database reads are filtered by the token subject; another user's check ID returns `404`.