import { useEffect, useState } from 'react';
import {
  clearNotifications, dismissNotification, getNotificationPreferences, getPushKey, listNotifications, markNotificationRead,
  removePushSubscription, savePushSubscription, updateNotificationPreferences,
} from '../api/notifications.js';
import '../styles/notifications.css';

const initialPreferences = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  inAppEnabled: true, emailEnabled: true, pushEnabled: false,
  remind7Days: true, remind3Days: true, remind1Day: true, remindDue: true, remindOverdue: true,
};

function decodeKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [items, prefs] = await Promise.all([listNotifications(), getNotificationPreferences()]);
      setNotifications(items.notifications);
      setUnreadCount(items.unreadCount);
      const localTimezone = initialPreferences.timezone;
      const effectivePrefs = prefs.isDefault && localTimezone !== 'UTC'
        ? await updateNotificationPreferences({ ...prefs, timezone: localTimezone })
        : prefs;
      setPreferences(effectivePrefs);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function markRead(id) {
    await markNotificationRead(id);
    setNotifications((items) => items.map((item) => (item.id === id ? { ...item, readAt: new Date().toISOString() } : item)));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function dismiss(id) {
    await dismissNotification(id);
    setNotifications((items) => items.filter((item) => item.id !== id));
  }

  async function clearAll() {
    await clearNotifications();
    setNotifications([]);
    setUnreadCount(0);
  }

  async function togglePreference(key) {
    setBusy(true);
    setError('');
    try {
      const next = await updateNotificationPreferences({ ...preferences, [key]: !preferences[key] });
      setPreferences(next);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePush() {
    setBusy(true);
    setError('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Browser push is not supported here.');
      const registration = await navigator.serviceWorker.register('/push-sw.js');
      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
        const next = await updateNotificationPreferences({ ...preferences, pushEnabled: false });
        setPreferences(next);
      } else {
        const publicKey = await getPushKey();
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') throw new Error('Browser notification permission was not granted.');
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
        await savePushSubscription(subscription.toJSON());
        const next = await updateNotificationPreferences({ ...preferences, pushEnabled: true });
        setPreferences(next);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-wrap">
      <button type="button" className="notification-bell" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" aria-label="Notifications">
          <div className="notification-panel-head">
            <h2>Notifications</h2>
            <div><button type="button" onClick={() => load()}>Refresh</button>{notifications.length > 0 && <button type="button" onClick={clearAll}>Clear all</button>}</div>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notifications.length === 0 ? <p className="notification-empty">You’re all caught up.</p> : (
            <ul className="notification-list">
              {notifications.map((item) => (
                <li key={item.id} className={item.readAt ? '' : 'notification-unread'}>
                  <a href={`/dashboard#task-${item.taskId}`} onClick={() => { if (!item.readAt) markRead(item.id); }}>{item.title}: {item.body}</a>
                  <button type="button" aria-label={`Dismiss ${item.title}`} onClick={() => dismiss(item.id)}>Dismiss</button>
                </li>
              ))}
            </ul>
          )}
          <div className="notification-preferences">
            <h3>Reminder preferences</h3>
            <label>Timezone <input value={preferences.timezone} disabled={busy} onChange={(event) => setPreferences((current) => ({ ...current, timezone: event.target.value }))} onBlur={() => updateNotificationPreferences(preferences).catch((requestError) => setError(requestError.message))} /></label>
            {['inAppEnabled', 'emailEnabled', 'remind7Days', 'remind3Days', 'remind1Day', 'remindDue', 'remindOverdue'].map((key) => (
              <label key={key}><input type="checkbox" checked={preferences[key]} disabled={busy} onChange={() => togglePreference(key)} /> {key.replace(/([A-Z])/g, ' $1')}</label>
            ))}
            <button type="button" disabled={busy} onClick={togglePush}>{preferences.pushEnabled ? 'Disable browser push' : 'Enable browser push'}</button>
          </div>
        </section>
      )}
    </div>
  );
}
