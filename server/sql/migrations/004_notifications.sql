-- Deadline notifications. Safe to run once; existing users and tasks are unchanged.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id        INT UNSIGNED NOT NULL,
  timezone       VARCHAR(64) NOT NULL DEFAULT 'UTC',
  in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
  email_enabled  TINYINT(1) NOT NULL DEFAULT 1,
  push_enabled   TINYINT(1) NOT NULL DEFAULT 0,
  remind_7_days  TINYINT(1) NOT NULL DEFAULT 1,
  remind_3_days  TINYINT(1) NOT NULL DEFAULT 1,
  remind_1_day   TINYINT(1) NOT NULL DEFAULT 1,
  remind_due     TINYINT(1) NOT NULL DEFAULT 1,
  remind_overdue TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_notification_preferences_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  endpoint   VARCHAR(2048) NOT NULL,
  p256dh    VARCHAR(255) NOT NULL,
  auth       VARCHAR(255) NOT NULL,
  expiration BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint(255)),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  task_id        INT UNSIGNED NOT NULL,
  channel        ENUM('in_app','email','push') NOT NULL,
  reminder_key   VARCHAR(16) NOT NULL,
  occurrence_date DATE NOT NULL,
  title          VARCHAR(180) NOT NULL,
  body           VARCHAR(1000) NOT NULL,
  scheduled_for  DATETIME NOT NULL,
  claimed_at     DATETIME NULL,
  sent_at        DATETIME NULL,
  read_at        DATETIME NULL,
  dismissed_at   DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_occurrence (user_id, task_id, channel, reminder_key, occurrence_date),
  KEY idx_notifications_user (user_id, dismissed_at, created_at),
  KEY idx_notifications_pending (scheduled_for, sent_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_task FOREIGN KEY (task_id)
    REFERENCES tasks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
