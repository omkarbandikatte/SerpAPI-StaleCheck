# SerpAPI StaleCheck

StaleCheck reviews dated notes, finds claims that may have changed, and compares them with current search evidence. It includes a public product site, an authenticated workspace, persistent check history, and a private pgvector evidence memory.

## Architecture

- Next.js 16 frontend with Neon Managed Better Auth
- FastAPI backend validating Neon EdDSA access tokens
- Gemini claim extraction, verification, and 768-dimensional embeddings
- Live Google, Google News, and Google Scholar results through SerpAPI
- Neon Postgres for owner-scoped checks and pgvector evidence retrieval

## Development

Start the backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

Add your Gemini, SerpAPI, Neon Postgres, and Neon Auth settings to `backend/.env`. Configure the same Auth instance in `frontend/.env.local`:

```env
NEON_AUTH_BASE_URL=https://your-auth-host.example/auth
NEON_AUTH_COOKIE_SECRET=at-least-32-random-characters
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

Then start the frontend in another terminal:

```bash
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The frontend defaults to `http://localhost:8001` for API calls. See [backend/README.md](backend/README.md) for the protected API contract.