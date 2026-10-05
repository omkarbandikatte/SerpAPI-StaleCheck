from dataclasses import dataclass
from urllib.parse import urlparse
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config

bearer = HTTPBearer(auto_error=False)
_jwks_client = jwt.PyJWKClient(config.NEON_AUTH_JWKS_URL, cache_jwk_set=True, lifespan=3600)


@dataclass(frozen=True)
class AuthUser:
	id: UUID
	email: str
	name: str


def get_current_user(
	credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> AuthUser:
	if credentials is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
	if not config.NEON_AUTH_BASE_URL or not config.NEON_AUTH_JWKS_URL:
		raise HTTPException(status_code=503, detail="Authentication is not configured.")

	parsed_url = urlparse(config.NEON_AUTH_BASE_URL)
	origin = f"{parsed_url.scheme}://{parsed_url.netloc}"
	try:
		signing_key = _jwks_client.get_signing_key_from_jwt(credentials.credentials)
		payload = jwt.decode(
			credentials.credentials,
			signing_key.key,
			algorithms=["EdDSA"],
			issuer=origin,
			audience=origin,
		)
		return AuthUser(
			id=UUID(str(payload["sub"])),
			email=str(payload.get("email", "")),
			name=str(payload.get("name", "")),
		)
	except (jwt.PyJWTError, KeyError, TypeError, ValueError) as error:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.") from error