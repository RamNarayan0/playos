// PLAYOS Service Worker for Realtime Notifications

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'PLAYOS Alert';
    const options = {
      body: data.body || 'You have a new update.',
      icon: '/icon.png', // Fallback to basic icon or string
      badge: '/badge.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/player'
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const targetUrl = event.notification.data.url;
      // If window is open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
