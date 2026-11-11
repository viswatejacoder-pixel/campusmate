-- CampusMate schema (MySQL 8.4, InnoDB, utf8mb4). Source of truth: docs/database.md section 2.
-- Safe to re-run: every statement is CREATE TABLE IF NOT EXISTS; nothing is dropped or altered.
-- Run as campusmate_app (needs CREATE, see database.md section 4). To change a table, reset the local DB (database.md section 6).
-- The `sessions` table is NOT here; express-mysql-session creates it (D-007).

USE campusmate;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  -- Email verification (T-075). NULL = not verified. Existing databases: migrations/001_email_verification.sql.
  email_verified_at       DATETIME NULL,
  verification_token_hash CHAR(64) NULL,   -- SHA-256 hex; the raw token is never stored
  verification_expires_at DATETIME NULL,
  verification_sent_at    DATETIME NULL,
  -- Password reset (migrations/002_password_reset.sql). NULL = no reset requested.
  reset_token_hash CHAR(64) NULL,          -- SHA-256 hex; the raw token is never stored
  reset_expires_at DATETIME NULL,
  reset_sent_at    DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_verification_token (verification_token_hash),
  UNIQUE KEY uq_users_reset_token (reset_token_hash)
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
