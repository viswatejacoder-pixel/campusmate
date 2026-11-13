import AppError from '../utils/AppError.js';
import { env } from '../config/env.js';
import {
  dismiss, dismissAll, getPreferences, listForUser, markRead, removePushSubscription, savePushSubscription, unreadCount, upsertPreferences,
} from '../models/notificationModel.js';

const invalid = (message = 'Invalid notification data.') => new AppError(400, 'VALIDATION_ERROR', message);
const id = (value) => (/^[1-9]\d*$/.test(value) ? Number(value) : null);

function preferences(value) {
  if (!value || typeof value !== 'object') throw invalid();
  const timezone = typeof value.timezone === 'string' ? value.timezone.trim() : 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { throw invalid('Timezone is invalid.'); }
  const bool = (key, fallback) => (value[key] === undefined ? fallback : value[key] === true);
  return {
    timezone,
    inAppEnabled: bool('inAppEnabled', true),
    emailEnabled: bool('emailEnabled', true),
    pushEnabled: bool('pushEnabled', false),
    remind7Days: bool('remind7Days', true),
    remind3Days: bool('remind3Days', true),
    remind1Day: bool('remind1Day', true),
    remindDue: bool('remindDue', true),
    remindOverdue: bool('remindOverdue', true),
  };
}

function toPreferences(row) {
  return {
    isDefault: Boolean(row.isDefault),
    timezone: row.timezone,
    inAppEnabled: Boolean(row.in_app_enabled),
    emailEnabled: Boolean(row.email_enabled),
    pushEnabled: Boolean(row.push_enabled),
    remind7Days: Boolean(row.remind_7_days),
    remind3Days: Boolean(row.remind_3_days),
    remind1Day: Boolean(row.remind_1_day),
    remindDue: Boolean(row.remind_due),
    remindOverdue: Boolean(row.remind_overdue),
  };
}

export async function list(req, res) {
  res.json({ notifications: await listForUser(req.userId), unreadCount: await unreadCount(req.userId) });
}

export async function count(req, res) {
  res.json({ unreadCount: await unreadCount(req.userId) });
}

export async function read(req, res) {
  const notificationId = id(req.params.id);
  if (!notificationId) throw invalid('Notification id is invalid.');
  await markRead(notificationId, req.userId);
  res.status(204).end();
}

export async function remove(req, res) {
  const notificationId = id(req.params.id);
  if (!notificationId) throw invalid('Notification id is invalid.');
  await dismiss(notificationId, req.userId);
  res.status(204).end();
}

export async function clear(req, res) {
  await dismissAll(req.userId);
  res.status(204).end();
}

export async function getPrefs(req, res) {
  res.json({ preferences: toPreferences(await getPreferences(req.userId)) });
}

export async function putPrefs(req, res) {
  res.json({ preferences: toPreferences(await upsertPreferences(req.userId, preferences(req.body))) });
}

export function pushKey(req, res) {
  if (!env.push.publicKey) return res.status(503).json({ error: { code: 'PUSH_NOT_CONFIGURED', message: 'Browser push is not configured.' } });
  res.json({ publicKey: env.push.publicKey });
}

export async function subscribe(req, res) {
  const subscription = req.body;
  if (!subscription || typeof subscription.endpoint !== 'string' || !/^https:\/\//.test(subscription.endpoint)
    || !subscription.keys || typeof subscription.keys.p256dh !== 'string' || typeof subscription.keys.auth !== 'string') throw invalid('Push subscription is invalid.');
  await savePushSubscription(req.userId, subscription);
  res.status(204).end();
}

export async function unsubscribe(req, res) {
  if (!req.body || typeof req.body.endpoint !== 'string') throw invalid('Push endpoint is required.');
  await removePushSubscription(req.userId, req.body.endpoint);
  res.status(204).end();
}
