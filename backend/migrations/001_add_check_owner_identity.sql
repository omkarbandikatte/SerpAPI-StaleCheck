ALTER TABLE public.checks
	ADD COLUMN IF NOT EXISTS owner_name text NOT NULL DEFAULT 'Unknown user',
	ADD COLUMN IF NOT EXISTS owner_email text NOT NULL DEFAULT '';

UPDATE public.checks AS checks
SET
	owner_name = COALESCE(NULLIF(BTRIM(auth_user.name), ''), auth_user.email, 'Unknown user'),
	owner_email = COALESCE(auth_user.email, '')
FROM neon_auth."user" AS auth_user
WHERE checks.user_id = auth_user.id
	AND (checks.owner_name = 'Unknown user' OR checks.owner_email = '');

ALTER TABLE public.checks
	ALTER COLUMN owner_name DROP DEFAULT,
	ALTER COLUMN owner_email DROP DEFAULT;