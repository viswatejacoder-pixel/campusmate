-- Password reset migration 002: reset-token columns on `users` (forgot password / reset password).
-- Run ONCE in MySQL Workbench as `root` (or another admin account with ALTER and INDEX), with the `campusmate` database selected.
-- Do NOT run it as `campusmate_app` and do NOT grant ALTER to it: that account is limited to SELECT, INSERT, UPDATE, DELETE, CREATE (database.md).
-- Stop at the first error. MySQL 8.4 has no ADD COLUMN IF NOT EXISTS, so a second run fails at step 1 (duplicate column) and changes nothing.
-- Fresh installs do not need this file: server/sql/schema.sql already contains these columns.
-- Existing rows are not changed: every new column is NULL, which means "no reset requested". No back-fill is needed.

-- ---------------------------------------------------------------------------
-- PREFLIGHT (run first; do not continue unless SHOW COLUMNS returns 0 rows)
-- ---------------------------------------------------------------------------
SHOW COLUMNS FROM users LIKE 'reset_token_hash';
-- Note this number for the postcheck.
SELECT COUNT(*) AS users_before FROM users;

-- ---------------------------------------------------------------------------
-- STEP 1: add the columns.
--   reset_token_hash  SHA-256 hex of the emailed reset token (the raw token is never stored); unique
--   reset_expires_at  token expiry (30 minutes, set by the server with DB-side NOW())
--   reset_sent_at     last reset email time (request cooldown)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN reset_token_hash CHAR(64) NULL AFTER verification_sent_at,
  ADD COLUMN reset_expires_at DATETIME NULL AFTER reset_token_hash,
  ADD COLUMN reset_sent_at    DATETIME NULL AFTER reset_expires_at,
  ADD UNIQUE KEY uq_users_reset_token (reset_token_hash);

-- ---------------------------------------------------------------------------
-- POSTCHECK (expected: total_users = users_before, with_reset_token = 0)
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS total_users, SUM(reset_token_hash IS NOT NULL) AS with_reset_token FROM users;
SHOW COLUMNS FROM users;
SHOW INDEX FROM users WHERE Key_name = 'uq_users_reset_token';

-- ---------------------------------------------------------------------------
-- ROLLBACK (commented out; run only if you must undo this migration; stop the server first).
-- It discards all pending reset tokens. The code from before this migration ignores these columns.
-- ---------------------------------------------------------------------------
-- ALTER TABLE users
--   DROP INDEX uq_users_reset_token,
--   DROP COLUMN reset_sent_at,
--   DROP COLUMN reset_expires_at,
--   DROP COLUMN reset_token_hash;