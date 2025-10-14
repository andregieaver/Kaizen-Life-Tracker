/* eslint-disable no-restricted-globals */
// Service Worker for Push Notifications
// Version: 1.0.1 - Updated drag handle position

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[Service Worker] Push data:', data);
      
      const options = {
        body: data.body,
        icon: data.icon || '/logo192.png',
        badge: data.badge || '/logo192.png',
        vibrate: [200, 100, 200],
        tag: 'trainsmart-notification',
        requireInteraction: false,
        data: {
          url: data.url || '/dashboard/reports'
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (error) {
      console.error('[Service Worker] Error parsing push data:', error);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/dashboard/reports';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing Service Worker...', event);
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating Service Worker...', event);
  event.waitUntil(self.clients.claim());
});
