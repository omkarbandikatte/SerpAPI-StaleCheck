# StaleCheck

StaleCheck reviews dated notes and identifies claims that may have changed. `/` is the public product page, while `/app` and `/check/*` are authenticated workspace routes.

## Environment variables

- `NEXT_PUBLIC_API_BASE_URL` sets the backend URL.
- `NEON_AUTH_BASE_URL` identifies the Managed Better Auth instance.
- `NEON_AUTH_COOKIE_SECRET` encrypts session data and must contain at least 32 random characters.

The API must expose check history, creation, status, and report endpoints. The API client obtains a short-lived JWT from the same-origin `/api/auth/token` proxy and attaches it as a bearer token.

## Development

Install dependencies with the package manager in `package.json`, then run `pnpm dev`. The report supports keyboard navigation with `j` and `k`, verdict filters with `1`–`4`, and `Esc` to close overlays.
