import pool from '../config/db.js';

const PREF_COLUMNS = 'timezone, in_app_enabled, email_enabled, push_enabled, remind_7_days, remind_3_days, remind_1_day, remind_due, remind_overdue';

export async function listForUser(userId, limit = 50) {
  const [rows] = await pool.execute(
    `SELECT id, task_id, channel, reminder_key, title, body, created_at, read_at
       FROM notifications
      WHERE user_id = ? AND sent_at IS NOT NULL AND dismissed_at IS NULL
      ORDER BY created_at DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    channel: row.channel,
    reminderKey: row.reminder_key,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function unreadCount(userId) {
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND sent_at IS NOT NULL AND read_at IS NULL AND dismissed_at IS NULL',
    [userId],
  );
  return Number(rows[0].count);
}

export async function markRead(id, userId) {
  await pool.execute('UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND user_id = ? AND dismissed_at IS NULL', [id, userId]);
}

export async function dismiss(id, userId) {
  await pool.execute('UPDATE notifications SET dismissed_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function dismissAll(userId) {
  await pool.execute('UPDATE notifications SET dismissed_at = NOW() WHERE user_id = ? AND dismissed_at IS NULL', [userId]);
}

export async function getPreferences(userId) {
  const [rows] = await pool.execute(`SELECT ${PREF_COLUMNS} FROM notification_preferences WHERE user_id = ?`, [userId]);
  return rows[0] || {
    isDefault: true,
    timezone: 'UTC', in_app_enabled: 1, email_enabled: 1, push_enabled: 0,
    remind_7_days: 1, remind_3_days: 1, remind_1_day: 1, remind_due: 1, remind_overdue: 1,
  };
}

export async function upsertPreferences(userId, preferences) {
  await pool.execute(
    `INSERT INTO notification_preferences
      (user_id, timezone, in_app_enabled, email_enabled, push_enabled, remind_7_days, remind_3_days, remind_1_day, remind_due, remind_overdue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE timezone = VALUES(timezone), in_app_enabled = VALUES(in_app_enabled),
       email_enabled = VALUES(email_enabled), push_enabled = VALUES(push_enabled),
       remind_7_days = VALUES(remind_7_days), remind_3_days = VALUES(remind_3_days),
       remind_1_day = VALUES(remind_1_day), remind_due = VALUES(remind_due), remind_overdue = VALUES(remind_overdue)`,
    [userId, preferences.timezone, preferences.inAppEnabled, preferences.emailEnabled, preferences.pushEnabled,
      preferences.remind7Days, preferences.remind3Days, preferences.remind1Day, preferences.remindDue, preferences.remindOverdue],
  );
  await pool.execute(
    `DELETE FROM notifications
      WHERE user_id = ? AND sent_at IS NULL
        AND ((channel = 'in_app' AND ? = 0) OR (channel = 'email' AND ? = 0) OR (channel = 'push' AND ? = 0))`,
    [userId, preferences.inAppEnabled ? 1 : 0, preferences.emailEnabled ? 1 : 0, preferences.pushEnabled ? 1 : 0],
  );
  return getPreferences(userId);
}

export async function savePushSubscription(userId, subscription) {
  await pool.execute(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, expiration)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), expiration = VALUES(expiration)`,
    [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.expirationTime || null],
  );
}

export async function removePushSubscription(userId, endpoint) {
  await pool.execute('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, endpoint]);
}

export async function subscriptionsForUser(userId) {
  const [rows] = await pool.execute('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
  return rows;
}

export async function deleteSubscription(id) {
  await pool.execute('DELETE FROM push_subscriptions WHERE id = ?', [id]);
}

export async function cancelPendingForTask(taskId, userId) {
  await pool.execute('DELETE FROM notifications WHERE task_id = ? AND user_id = ? AND sent_at IS NULL', [taskId, userId]);
}

export async function createReminder(row) {
  await pool.execute(
    `INSERT IGNORE INTO notifications
      (user_id, task_id, channel, reminder_key, occurrence_date, title, body, scheduled_for)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [row.userId, row.taskId, row.channel, row.reminderKey, row.occurrenceDate, row.title, row.body],
  );
}

export async function pendingTasks() {
  const [rows] = await pool.execute(
    `SELECT t.id AS task_id, t.user_id, t.title, t.due_date, u.email,
            COALESCE(p.timezone, 'UTC') AS timezone,
            COALESCE(p.in_app_enabled, 1) AS in_app_enabled,
            COALESCE(p.email_enabled, 1) AS email_enabled,
            COALESCE(p.push_enabled, 0) AS push_enabled,
            COALESCE(p.remind_7_days, 1) AS remind_7_days,
            COALESCE(p.remind_3_days, 1) AS remind_3_days,
            COALESCE(p.remind_1_day, 1) AS remind_1_day,
            COALESCE(p.remind_due, 1) AS remind_due,
            COALESCE(p.remind_overdue, 1) AS remind_overdue
       FROM tasks t JOIN users u ON u.id = t.user_id
       LEFT JOIN notification_preferences p ON p.user_id = t.user_id
      WHERE t.is_completed = 0`,
  );
  return rows;
}

export async function claim(id) {
  const [result] = await pool.execute(
    'UPDATE notifications SET claimed_at = NOW() WHERE id = ? AND sent_at IS NULL AND dismissed_at IS NULL AND (claimed_at IS NULL OR claimed_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE))',
    [id],
  );
  return result.affectedRows === 1;
}

export async function delivered(id) {
  await pool.execute('UPDATE notifications SET sent_at = NOW(), claimed_at = NULL WHERE id = ?', [id]);
}

export async function releaseClaim(id) {
  await pool.execute('UPDATE notifications SET claimed_at = NULL WHERE id = ? AND sent_at IS NULL', [id]);
}
