/**
 * EPMS Web Push Service Worker
 * Handles background push notification display and navigation click events.
 */

function resolvePushActionTarget(link, target) {
  if (typeof link === 'string' && link.trim().length > 0) return link.trim();
  if (typeof target === 'string' && target.trim().length > 0) return target.trim();
  return '/';
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'EPMS Notification';
  const body = payload.body || payload.message || 'Anda memiliki notifikasi baru di EPMS.';
  const tag = payload.tag || payload.dedupeKey || 'epms-notification';
  const actionLink = resolvePushActionTarget(payload.actionLink, payload.actionTarget);

  const options = {
    body: body,
    icon: '/icons/epms-icon-192.png?v=20261105',
    badge: '/icons/epms-icon-192.png?v=20261105',
    tag: tag,
    renotify: false,
    requireInteraction: false,
    data: {
      actionLink: actionLink,
      actionTarget: payload.actionTarget,
      notificationId: payload.notificationId,
      eventId: payload.eventId,
      purpose: payload.purpose,
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(function () {
      // Best-effort quiet sync to open tabs
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
        clientList.forEach(function (client) {
          client.postMessage({
            type: 'EPMS_PUSH_RECEIVED',
            payload: options.data,
          });
        });
      });
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};
  const rawActionLink = resolvePushActionTarget(data.actionLink, data.actionTarget);

  // Strict origin validation to prevent open-redirect vulnerabilities
  let targetUrl;
  try {
    targetUrl = new URL(rawActionLink, self.location.origin);
    if (targetUrl.origin !== self.location.origin) {
      targetUrl = new URL('/', self.location.origin);
    }
  } catch (err) {
    targetUrl = new URL('/', self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open on this origin, focus it and navigate
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus().then(function () {
            if ('navigate' in client) {
              return client.navigate(targetUrl.href);
            }
          });
        }
      }

      // If no window is open, open a new window with target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href);
      }
    })
  );
});

