import { request } from './client.js';

export const listNotifications = () => request('GET', '/api/notifications');
export const markNotificationRead = (id) => request('PATCH', `/api/notifications/${encodeURIComponent(id)}/read`);
export const dismissNotification = (id) => request('DELETE', `/api/notifications/${encodeURIComponent(id)}`);
export const clearNotifications = () => request('DELETE', '/api/notifications');
export const getNotificationPreferences = async () => (await request('GET', '/api/notifications/preferences')).preferences;
export const updateNotificationPreferences = async (preferences) => (await request('PUT', '/api/notifications/preferences', { body: preferences })).preferences;
export const getPushKey = async () => (await request('GET', '/api/notifications/push-key')).publicKey;
export const savePushSubscription = (subscription) => request('POST', '/api/notifications/push-subscription', { body: subscription });
export const removePushSubscription = (endpoint) => request('DELETE', '/api/notifications/push-subscription', { body: { endpoint } });
