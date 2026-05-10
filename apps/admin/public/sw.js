// Service worker for Wardrobe Assistants Admin PWA (iter-23).
// Push + notificationclick only — no fetch handler, no caching, no offline.
// Reference: node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (err) {
    console.error("[sw] failed to parse push payload", err);
    return;
  }
  if (!payload || typeof payload.title !== "string" || !payload.title) {
    console.error("[sw] push payload missing required title");
    return;
  }
  const body = typeof payload.body === "string" ? payload.body : "";
  const url = typeof payload.url === "string" ? payload.url : undefined;
  // Only accept same-origin absolute paths for icon — reject cross-origin URLs.
  const icon =
    typeof payload.icon === "string" && payload.icon.startsWith("/")
      ? payload.icon
      : "/icon-192.png";
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body,
      icon,
      badge: "/badge-72.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url;
  let target = "/";
  if (typeof raw === "string") {
    try {
      const parsed = new URL(raw, self.location.origin);
      // Reject dangerous schemes like javascript: and data:.
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        target = parsed.href;
      }
    } catch {
      // Fall through to "/".
    }
  }
  event.waitUntil(clients.openWindow(target));
});
