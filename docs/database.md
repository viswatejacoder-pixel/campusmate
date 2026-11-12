# Database

Last updated: 2026-11-12 | Status: Schema and session-store setup verified locally on MySQL 8.4.13; restore drill remains untested

Target: MySQL 8.4 (installed 8.4.13, service `MySQL84`, verified running 2026-10-29; D-021), InnoDB, `utf8mb4` (default collation `utf8mb4_0900_ai_ci`, case-insensitive, so emails differing only by case collide on the unique key). Database name: `campusmate`.
The schema below uses only plain MySQL 8 features. T-020 recorded that it was applied and rerun successfully, and that `express-mysql-session` created its table using the limited app account. Use the default `caching_sha2_password` for the app user (`mysql_native_password` is disabled by default in 8.4).

## 1. Entities
`users` 1 --- N `subjects` 1 --- N `tasks`; every task also belongs directly to a user. A composite foreign key makes the database itself guarantee that a task's subject belongs to the same user (defence in depth on top of server checks).

## 2. Schema (`server/sql/schema.sql`; fresh-database definition)
```sql
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  -- T-075 email verification (existing databases: server/sql/migrations/001_email_verification.sql, run once as an admin)
  email_verified_at       DATETIME NULL,   -- NULL = not verified
  verification_token_hash CHAR(64) NULL,   -- SHA-256 hex of the emailed token; the raw token is never stored
  verification_expires_at DATETIME NULL,   -- 30 minutes after sending
  verification_sent_at    DATETIME NULL,   -- resend cooldown (60 s)
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_verification_token (verification_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subjects (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_user_name (user_id, name),
  UNIQUE KEY uq_subjects_id_user (id, user_id),
  CONSTRAINT fk_subjects_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  subject_id   INT UNSIGNED NOT NULL,
  title        VARCHAR(150) NOT NULL,
  description  VARCHAR(1000) NULL,
  due_date     DATE NOT NULL,
  priority     ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  is_completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_tasks_user_due (user_id, due_date),
  KEY idx_tasks_user_status (user_id, is_completed),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_subject FOREIGN KEY (subject_id, user_id)
    REFERENCES subjects (id, user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
The `sessions` table is created automatically by `express-mysql-session` (D-007/D-008); its local MySQL 8.4 creation and session lifecycle were verified.

## 3.1 Backup and recovery runbook (local/staging preparation)

This runbook is preparatory documentation only. No backup or restore command was run during T-100, and no restore may target the existing `campusmate` database without an explicit maintenance approval.

### Backup

1. Confirm the target database and host in the deployment change record; never put a password on a command line or in a script.
2. Use a protected backup directory outside the repository. With the MySQL client installed, enter the password interactively:

   ```powershell
   & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe" `
     --host=<private-db-host> --port=3306 --user=campusmate_app -p `
     --single-transaction --routines --triggers --hex-blob `
     campusmate | Out-File -Encoding utf8 "D:\campusmate-backups\campusmate-<UTC timestamp>.sql"
   ```

3. Store the dump with restrictive filesystem permissions and retain it outside Git, `.qa-tmp/`, and the application host when possible.
4. Record the timestamp, schema version/migration state, dump exit code, file size, and a SHA-256 checksum. Do not record credentials or session contents.
5. A backup is not considered verified until a checksum succeeds and the dump can be parsed or restored into a disposable isolated database.

### Recovery and rollback precautions

1. Declare maintenance mode and stop application writes before recovery. Preserve the original database; do not drop or overwrite it as the first action.
2. Provision a disposable MySQL 8.4-compatible database with a separate name and least-privilege account.
3. Restore the dump into that disposable database, then verify tables, indexes, foreign keys, row counts, application health, and a read-only login/session smoke test.
4. Apply migrations in order only when the restored schema requires them: `001_email_verification.sql`, then `002_password_reset.sql`. Each migration's preflight must show zero matching columns before execution; never rerun a migration after a partial success.
5. `server/sql/schema.sql` is for a fresh database and should not be applied over a live restored database. The `sessions` table is created by `express-mysql-session`; preserve its rows only when session continuity is intentionally required.
6. If validation fails, discard only the disposable database and investigate. Keep the original database untouched. Cut over only after an approved maintenance window and a fresh backup.

### Recovery targets and current evidence

For a small local/staging deployment, use **RPO: 24 hours** and **RTO: 4 hours** as planning targets until measured. These are targets, not a production guarantee. The restore drill is currently **BLOCKED / NOT TESTED** because no disposable isolated database was available and destructive operations were not authorized.

## 4. Design notes
- **Overdue / due soon are derived, not stored:** `is_completed = 0 AND due_date < CURDATE()` (overdue); `is_completed = 0 AND due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 3 DAY` (due soon). Nothing needs a nightly update job. Implemented in `server/src/models/taskModel.js` (T-050): the same two expressions are used for the `isOverdue`/`isDueSoon` flags, the `status=overdue` filter and the summary counts, so they always agree. `CURDATE()` is the MySQL server's date (OQ-10); on the development machine the MySQL time zone is `SYSTEM` (IST) and matched the Node date.
- **Timestamps:** `created_at` and `updated_at` are `TIMESTAMP`; `completed_at` is a `DATETIME` set with `NOW()` in the MySQL session time zone. The API reads all three with `UNIX_TIMESTAMP()` and returns ISO-8601 UTC, so the output does not depend on the session time zone.
- **Email** is stored lower-cased and trimmed by the server.
- **Subject delete** is blocked while tasks reference it (`ON DELETE RESTRICT`); the API turns this into a 409 with a clear message.
- **Every task/subject query must include `user_id = ?`** taken from the session, never from the request body.
- Account deletion is not an MVP feature, so cascade behaviour on user delete is untested.

## 5. Local database setup (planned; run as a database admin; replace the password placeholder)
The MySQL 8.4 service (`MySQL84`) must be running (check: `Get-Service MySQL84`). The client is not on the system PATH; run it as `& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p` (enter your own root password when prompted; never paste it into chat, docs, or `.env`) or use MySQL Workbench. Do not expose port 3306 beyond your own machine.
```sql
CREATE DATABASE IF NOT EXISTS campusmate CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'campusmate_app'@'localhost' IDENTIFIED BY '<choose-a-local-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON campusmate.* TO 'campusmate_app'@'localhost';
```
`CREATE` is needed only so the session store can create its table; it can be revoked once the table exists. Put the same password in your local `server/.env`. Never use the `root` account in the app.

## 6. Seed data
`server/sql/seed.sql` (optional, for demo screenshots) will use fictional users such as `demo.student@example.com`. Password hashes must be generated with a script at setup time, never hard-coded real passwords. Seed users must be clearly labelled demo data.

## 7. Schema change process
Edit `server/sql/schema.sql`, note the change in `CHANGELOG.md`, update this file and `api-spec.md`. For MVP there are no migration tools; a reset (drop and re-create the local DB) is acceptable.
