import * as webpush from 'web-push';
import { env } from '../config/env.js';
import pool from '../config/db.js';
import { sendDeadlineReminderEmail } from './mailer.js';
import {
  claim, createReminder, delivered, deleteSubscription, pendingTasks, releaseClaim, subscriptionsForUser,
} from '../models/notificationModel.js';
import { localDate, reminderFor } from './notificationSchedule.js';

const INTERVAL_MS = 5 * 60 * 1000;

function message(task, reminder) {
  return `Task "${task.title}" ${reminder.label}.`;
}

async function seedTaskReminders(task) {
  const reminder = reminderFor(task, localDate(task.timezone));
  if (!reminder) return;
  const channels = [];
  if (task.in_app_enabled) channels.push('in_app');
  if (task.email_enabled) channels.push('email');
  if (task.push_enabled) channels.push('push');
  await Promise.all(channels.map((channel) => createReminder({
    userId: task.user_id,
    taskId: task.task_id,
    channel,
    reminderKey: reminder.key,
    occurrenceDate: reminder.occurrenceDate,
    title: 'Deadline reminder',
    body: message(task, reminder),
  })));
}

async function deliver(row) {
  if (!(await claim(row.id))) return;
  try {
    if (row.channel === 'email') {
      await sendDeadlineReminderEmail({ to: row.email, taskId: row.task_id, taskTitle: row.task_title, dueDate: row.due_date, reminderKey: row.reminder_key });
    } else if (row.channel === 'push') {
      if (!env.push.publicKey || !env.push.privateKey || !env.push.subject) {
        await delivered(row.id);
        return;
      }
      webpush.setVapidDetails(env.push.subject, env.push.publicKey, env.push.privateKey);
      const subscriptions = await subscriptionsForUser(row.user_id);
      let deliveredToSubscription = false;
      let failedSubscription = false;
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            JSON.stringify({ title: row.title, body: row.body, taskId: row.task_id }),
          );
          deliveredToSubscription = true;
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) await deleteSubscription(subscription.id);
          else {
            failedSubscription = true;
            console.error(`Push delivery failed (${error.statusCode || error.code || 'UNKNOWN'})`);
          }
        }
      }
      if (failedSubscription && !deliveredToSubscription) {
        throw Object.assign(new Error('all push deliveries failed'), { code: 'PUSH_DELIVERY_FAILED' });
      }
    }
    await delivered(row.id);
  } catch (error) {
    await releaseClaim(row.id);
    console.error(`Notification delivery failed (${error.code || error.name || 'UNKNOWN'})`);
  }
}

export async function runReminderSweep() {
  const tasks = await pendingTasks();
  await Promise.all(tasks.map(seedTaskReminders));
  const [rows] = await pool.execute(
    `SELECT n.id, n.user_id, n.task_id, n.channel, n.reminder_key, n.title, n.body,
            t.title AS task_title, t.due_date, u.email
       FROM notifications n JOIN tasks t ON t.id = n.task_id JOIN users u ON u.id = n.user_id
      WHERE n.sent_at IS NULL AND n.dismissed_at IS NULL AND n.scheduled_for <= NOW()
      ORDER BY n.id ASC LIMIT 500`,
  );
  await Promise.all(rows.map(deliver));
  return { seeded: tasks.length, delivered: rows.length };
}

export function startReminderWorker() {
  const timer = setInterval(() => {
    runReminderSweep().catch((error) => console.error(`Reminder sweep failed (${error.code || error.name || 'UNKNOWN'})`));
  }, INTERVAL_MS);
  timer.unref();
  runReminderSweep().catch((error) => console.error(`Initial reminder sweep failed (${error.code || error.name || 'UNKNOWN'})`));
  return timer;
}
