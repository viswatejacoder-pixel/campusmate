# Database

Last updated: 2026-10-25 | Status: Proposed schema (not yet created in MySQL, not yet tested)

MySQL 8.x, InnoDB, `utf8mb4`. Database name: `campusmate`.

## 1. Entities
`users` 1 --- N `subjects` 1 --- N `tasks`; every task also belongs directly to a user. A composite foreign key makes the database itself guarantee that a task's subject belongs to the same user (defence in depth on top of server checks).

## 2. Schema (planned `sql/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
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
The `sessions` table is created automatically by `express-mysql-session` (if approved, D-008/D-007).

## 3. Design notes
- **Overdue / due soon are derived, not stored:** `is_completed = 0 AND due_date < CURDATE()` (overdue); `is_completed = 0 AND due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 3 DAY` (due soon). Nothing needs a nightly update job.
- **Email** is stored lower-cased and trimmed by the server.
- **Subject delete** is blocked while tasks reference it (`ON DELETE RESTRICT`); the API turns this into a 409 with a clear message.
- **Every task/subject query must include `user_id = ?`** taken from the session, never from the request body.
- Account deletion is not an MVP feature, so cascade behaviour on user delete is untested.

## 4. Local MySQL setup (planned; run as a MySQL admin; replace the password placeholder)
```sql
CREATE DATABASE IF NOT EXISTS campusmate CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'campusmate_app'@'localhost' IDENTIFIED BY '<choose-a-local-password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE ON campusmate.* TO 'campusmate_app'@'localhost';
```
`CREATE` is needed only so the session store can create its table; it can be revoked once the table exists. Put the same password in your local `.env`. Never use the MySQL `root` account in the app.

## 5. Seed data
`sql/seed.sql` (optional, for demo screenshots) will use fictional users such as `demo.student@example.com`. Password hashes must be generated with a script at setup time, never hard-coded real passwords. Seed users must be clearly labelled demo data.

## 6. Schema change process
Edit `sql/schema.sql`, note the change in `CHANGELOG.md`, update this file and `api-spec.md`. For MVP there are no migration tools; a reset (drop and re-create the local DB) is acceptable.
