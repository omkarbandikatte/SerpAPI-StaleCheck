import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

FRONTEND_ORIGINS = [
	origin.strip()
	for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").split(",")
	if origin.strip()
]
DATABASE_URL = os.getenv("DATABASE_URL", "")
NEON_AUTH_BASE_URL = os.getenv("NEON_AUTH_BASE_URL", "")
NEON_AUTH_JWKS_URL = os.getenv("NEON_AUTH_JWKS_URL", f"{NEON_AUTH_BASE_URL}/.well-known/jwks.json")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True, parents=True)

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-flash-lite-latest")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_DOCUMENT_CHARS = int(os.getenv("MAX_DOCUMENT_CHARS", "120000"))
SERPAPI_RESULTS_PER_ENGINE = int(os.getenv("SERPAPI_RESULTS_PER_ENGINE", "3"))