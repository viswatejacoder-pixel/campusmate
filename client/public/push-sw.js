self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'CampusMate reminder', {
    body: data.body || 'You have an upcoming deadline.',
    data: { taskId: data.taskId },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data && event.notification.data.taskId;
  const target = taskId ? `/dashboard#task-${encodeURIComponent(taskId)}` : '/dashboard';
  event.waitUntil(clients.openWindow(target));
});
