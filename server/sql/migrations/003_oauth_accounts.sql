-- OAuth identity migration 003. Existing users and rows are unchanged.
-- Run once with an account allowed to create tables; do not run automatically in production.
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider   VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  subject    VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_provider_subject (provider, subject),
  KEY idx_oauth_user (user_id),
  CONSTRAINT fk_oauth_accounts_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
