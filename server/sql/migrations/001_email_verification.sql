-- T-075 migration 001: email verification columns on `users`.
-- Run ONCE in MySQL Workbench as `root` (or another admin account with ALTER and INDEX), with the `campusmate` database selected.
-- Do NOT run it as `campusmate_app` and do NOT grant ALTER to it: that account is limited to SELECT, INSERT, UPDATE, DELETE, CREATE (database.md) and the app needs nothing more.
-- Stop at the first error. MySQL 8.4 has no ADD COLUMN IF NOT EXISTS, so a second run fails at step 1 (duplicate column) and changes nothing.
-- Fresh installs do not need this file: server/sql/schema.sql already contains these columns.

-- ---------------------------------------------------------------------------
-- PREFLIGHT (run first; do not continue unless the SHOW COLUMNS returns 0 rows)
-- ---------------------------------------------------------------------------
SHOW COLUMNS FROM users LIKE 'email_verified_at';
-- Note this number for the postcheck.
SELECT COUNT(*) AS users_before FROM users;

-- ---------------------------------------------------------------------------
-- STEP 1: add the columns. Every column is NULL with no default, so NEW users are unverified.
--   email_verified_at        NULL = not verified; set when the emailed link is confirmed
--   verification_token_hash  SHA-256 hex of the emailed token (the raw token is never stored)
--   verification_expires_at  token expiry (30 minutes, set by the server with DB-side NOW())
--   verification_sent_at     last send time (resend cooldown)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN email_verified_at       DATETIME NULL AFTER password_hash,
  ADD COLUMN verification_token_hash CHAR(64) NULL AFTER email_verified_at,
  ADD COLUMN verification_expires_at DATETIME NULL AFTER verification_token_hash,
  ADD COLUMN verification_sent_at    DATETIME NULL AFTER verification_expires_at,
  ADD UNIQUE KEY uq_users_verification_token (verification_token_hash);

-- ---------------------------------------------------------------------------
-- STEP 2: explicit back-fill. Existing users are preserved as verified (decision, 2026-10-31).
-- If Step 2 alone fails after Step 1 succeeded (for example Workbench Safe Updates error 1175), run ONLY Step 2 again; do NOT rerun the full migration (Step 1 would fail on the duplicate column).
-- The token-hash condition means a pending sign-up (always has a token hash) can never be verified by this statement.
-- ---------------------------------------------------------------------------
UPDATE users
SET email_verified_at = NOW()
WHERE email_verified_at IS NULL
  AND verification_token_hash IS NULL
  AND id > 0; -- key-column condition so Workbench Safe Updates accepts the statement; matches every row

-- ---------------------------------------------------------------------------
-- POSTCHECK (expected: total_users = users_before, unverified_users = 0, with_token_hash = 0)
-- ---------------------------------------------------------------------------
SELECT COUNT(*)                                 AS total_users,
       SUM(email_verified_at IS NULL)           AS unverified_users,
       SUM(verification_token_hash IS NOT NULL) AS with_token_hash
FROM users;
SHOW COLUMNS FROM users;
SHOW INDEX FROM users WHERE Key_name = 'uq_users_verification_token';

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented out; run only if you must undo this migration; stop the server first).
-- It discards all verification state. The pre-T-075 code ignores these columns.
-- ---------------------------------------------------------------------------
-- ALTER TABLE users
--   DROP INDEX uq_users_verification_token,
--   DROP COLUMN verification_sent_at,
--   DROP COLUMN verification_expires_at,
--   DROP COLUMN verification_token_hash,
--   DROP COLUMN email_verified_at;
