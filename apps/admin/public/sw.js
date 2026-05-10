// Service worker for Wardrobe Assistants Admin PWA (iter-23).
// Push + notificationclick only — no fetch handler, no caching, no offline.
// Reference: node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title, body, icon, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192.png",
      badge: "/badge-72.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
