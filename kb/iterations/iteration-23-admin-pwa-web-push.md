---
title: Iteration 23 — Admin PWA + Web Push notifications
type: iteration
order: 24
status: implemented
---

# Iteration 23 — Admin PWA + Web Push notifications

iter-21 deferred SMS and WhatsApp. This iteration ships the alternative: install the admin app as a PWA on iOS/Android/desktop, and use Web Push as a parallel realtime channel alongside email. Push and email both fire for every notifying trigger — push for immediacy, email for durability.

The iteration is scoped as one unit because the two halves are tightly coupled: PWA without push misses the realtime UX win, and push without PWA misses every iPhone user (Safari only delivers Web Push to home-screen-installed PWAs).

## Decisions (confirmed pre-iter-23)

- **Always send both push and email** for any notifying trigger. No per-user "push-only" mode in this iteration; revisit when a user complains.
- **Hand-rolled service worker, no Serwist, no offline.** Offline support is **permanently out of scope** for this product — admin work always happens online. The service worker exists only to receive push events; ~30 lines of vanilla JS, no caching strategy, no Serwist, no Workbox. Don't add `cache.addAll(...)` "for free" — every fetch handler we don't write is a class of bugs we don't have.
- **`app/manifest.ts`** (Next.js file convention) for the manifest, not a static file. Lets us pull `name` / `start_url` from a single source as the app evolves.
- **Subscription presence is opt-in.** A row in `push_subscriptions` for a given user means "send push to this device." No separate `notificationChannel` enum. Browser permission grant + server-side row = subscribed. Revoke = delete row.

## Reference: Next.js 16 PWA guide (local)

Read this first before implementing:

- `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` — full walkthrough (manifest, push manager component, VAPID, service worker, security headers, local HTTPS).
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` — `MetadataRoute.Manifest` typed reference.

The doc is **not** on the public Next.js docs site nav at the time of writing — only in `node_modules/next/dist/docs/`. Quote the file path in any PR description so the next reader can find it.

## Pre-flight

- [ ] iter-20 (email senders) merged. Push is wired alongside the existing email send paths — both channels are dispatched from the same call site.
- [ ] Decide where the dispatcher lives: cross-cutting infra in `apps/admin/src/lib/notify.ts` (recommended — same layer as `lib/email.ts`), or feature-owned. See [`kb/admin-architecture/overview.md`](../admin-architecture/overview.md).
- [ ] Verify production HTTPS chain end-to-end (already in place via bunny.net — admin.wardrobe-assistants.ch). Web Push **requires** HTTPS at every hop.

## Scope

### 1. Web app manifest — `apps/admin/src/app/manifest.ts`

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wardrobe Assistants Admin",
    short_name: "WA Admin",
    description: "Squad coordination for Wardrobe Assistants",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7d2b3b",          // bordeaux brand override (iter-16i)
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

- Icons live under `apps/admin/public/`. Generate the set with `realfavicongenerator.net` (or similar); commit the PNGs.
- Maskable icon for Android adaptive-icon support.

### 2. Service worker — `apps/admin/public/sw.js`

Hand-rolled, vanilla JS, no build step. Two handlers:

```js
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
```

- No caching strategy. This SW exists *only* for push.
- `notificationclick` opens the targeted URL (e.g. the assigned event's detail page).

### 3. Security headers for `/sw.js`

Add to `apps/admin/next.config.ts` `headers()` block:

```ts
{
  source: "/sw.js",
  headers: [
    { key: "Content-Type", value: "application/javascript; charset=utf-8" },
    { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
    { key: "Service-Worker-Allowed", value: "/" },
  ],
},
```

- The existing global `Cache-Control: private, no-store, must-revalidate` from iter-16b already covers `/sw.js`, but the explicit override documents intent.
- Do **not** add a per-route CSP for `/sw.js` here — the dynamic CSP in `src/proxy.ts` (with per-request nonce) is the source of truth. **Verify** that `default-src 'self'` (or whatever proxy.ts emits) permits service-worker registration. If not, extend `proxy.ts` with `worker-src 'self'` rather than diverging in `next.config.ts`. This is the same pattern iter-16b established for CSP.

### 4. CSP audit — `apps/admin/src/proxy.ts`

Read the current emitted CSP. Verify that:
- `worker-src 'self'` is present (or implicitly allowed via `default-src 'self'`).
- `connect-src` allows the push endpoint (the browser handles the actual push transport — no app-side connect is needed once subscribed, but the *subscribe* call goes through the browser's PushManager and shouldn't be CSP-restricted).
- The service worker itself runs in its own context and is not subject to the page's CSP for its own fetches; but the `/sw.js` *response* must come through.

Document any CSP changes in a comment block citing the iter-16b CSP pattern.

### 5. Push subscription storage — `packages/db/src/schema/push-subscriptions.ts`

```ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),                                      // ulid
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),                    // browser-issued push endpoint URL
  p256dh: text("p256dh").notNull(),                                 // public key
  auth: text("auth").notNull(),                                     // auth secret
  userAgent: text("user_agent"),                                    // best-effort device label for the user's "manage devices" UI
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});
```

- One row = one device's subscription. A user with phone + laptop = two rows.
- `endpoint` unique to dedupe re-subscribes from the same browser.
- `onDelete: cascade` — when a user is deleted, their subscriptions go too.
- Migration via the iter-15b auto-migration setup.

### 6. VAPID keys + env

- Generate once with `npx web-push generate-vapid-keys`.
- Env vars (managed via `hoppy template env --update` per project convention):
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — exposed to client (used by `pushManager.subscribe`).
  - `VAPID_PRIVATE_KEY` — server-only, signs push messages.
  - `VAPID_SUBJECT` — `mailto:notify@wardrobe-assistants.ch` or similar.
- Add validation to `apps/admin/src/lib/env.ts`. Push paths short-circuit (no-op + warn) if any of the three are missing — same dev-fallback pattern as `lib/email.ts`.

### 7. Push send infra — `apps/admin/src/lib/push.ts`

Mirrors `lib/email.ts` shape. Lazy `web-push` import + provider construction:

```ts
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string }) {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return { sent: 0 };

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      // 404 / 410 = subscription gone; delete the row.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
      } else {
        // log + swallow; one bad device shouldn't block the rest
      }
    }
  }));
  return { sent };
}
```

- Stale-subscription cleanup is **part of the send path**, not a separate cron. The first failed send is when we learn a subscription is dead.

### 8. Dispatcher — `apps/admin/src/lib/notify.ts`

The single cross-channel entry point. Replaces direct calls to `sendTemplated(...)` for any trigger that has a push-eligible counterpart:

```ts
export async function notifyUser(
  userId: string,
  templateKey: NotifiableTemplateKey,
  params: NotifyParamsFor<TemplateKey>,
) {
  const user = await getUserById(userId);
  if (!user) return;

  // Always both, per iter-23 decision.
  const [emailResult, pushResult] = await Promise.allSettled([
    sendTemplated(templateKey, user.email, params),
    sendPush(userId, pushPayloadFor(templateKey, params)),
  ]);

  // log results; failures in one channel don't block the other
}
```

- Type-safe per template key. `NotifiableTemplateKey` is a subset of iter-20's templates — admin-internal templates like `requestParticipationToAdmin` are notifiable, but `userInvited` is not (recipient hasn't subscribed yet — they don't even have an account).
- `pushPayloadFor(...)` lives next to the template definition (iter-20 `email-templates/<key>.tsx`) as a sibling export — colocation keeps the two channels in sync when copy changes.

### 9. Trigger surface — wire up

Replace the `sendTemplated(...)` calls landed in iter-20 with `notifyUser(...)` for these triggers:

| Template key | Triggers | Push? |
|---|---|---|
| `eventAssigned` | Admin assigns squad member to event | Yes |
| `userMessageFromAdmin` | "Message all assigned" | Yes — fan out via `Promise.all(recipients.map(notifyUser))` |
| `requestParticipationToAdmin` | Squad member requests participation (iter-18) | Yes — to all admins |
| `userInvited` | Invite to new user | **No** (no subscription yet — email only via `sendTemplated`) |

### 10. Client UI — install prompt + subscribe toggle

Two small components in `apps/admin/src/components/`:

**`PushSubscribeToggle.tsx`** — visible in user settings or the dashboard header (placement TBD, lean header). Shows current subscription status; "Enable notifications" button calls `Notification.requestPermission()` → `pushManager.subscribe()` → server action `subscribePush(sub)` that inserts into `push_subscriptions`.

**`InstallPrompt.tsx`** — detects iOS Safari outside standalone mode, shows the "tap share → Add to Home Screen" hint. Hidden on Android/desktop (browsers show their own install prompt) and when `display-mode: standalone` matches. Per the Next.js doc, **don't** wire `beforeinstallprompt` for a custom button — not cross-browser, doesn't work on iOS.

Both components mount at the dashboard layout. They're feature-flagged off until the SW registration succeeds (`isSupported = "serviceWorker" in navigator && "PushManager" in window`).

### 11. Service worker registration

In `apps/admin/src/components/PushSubscribeToggle.tsx` (or a new `useServiceWorker` hook): on mount, `navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })`. `updateViaCache: "none"` ensures the SW reloads on each registration (defense in depth alongside the `Cache-Control: no-store` header).

### 12. Server actions — `apps/admin/src/app/(dashboard)/actions/push.ts`

- `subscribePush(sub: PushSubscriptionJSON)` — auth-gated; insert/upsert by endpoint into `push_subscriptions`.
- `unsubscribePush(endpoint: string)` — auth-gated; delete the row matching userId + endpoint.

These are server actions, not API routes — keep with the iter-15+ feature-slice pattern.

## Tests

- **Unit**: `lib/push.ts` send path with mocked `web-push` (verify VAPID setup, payload shape, 404/410 cleanup behavior). Snapshot test the manifest output.
- **Smoke** (`*.smoke.test.ts` against the http-harness from iter-15c):
  - `GET /manifest.webmanifest` returns 200 + correct `Content-Type: application/manifest+json` (Next emits this automatically).
  - `GET /sw.js` returns 200 + `Service-Worker-Allowed: /` + `Cache-Control: no-store`.
  - `subscribePush` server action persists a row when called by an authed user; rejects unauthed calls.
- **a11y**: `PushSubscribeToggle` and `InstallPrompt` get the standard `vitest-axe` smoke per `kb/admin-architecture/design-system.md`.

## Out of scope

- **Offline support of any kind.** Permanently out of scope — not deferred, not "revisit later." No `fetch` handler in the SW, no cache APIs, no Serwist, no Workbox. The admin app requires connectivity to function; if a future requirement changes that, it's a bigger architectural conversation than a follow-up iter.
- **Background sync / periodic sync.** Not needed; push is the realtime channel.
- **Push for the public homepage** (`apps/homepage`). Admin only.
- **Per-trigger channel preferences.** All notifiable triggers go to both channels; no UI to mute push for one event type but not another.
- **Push to admins for user-side events** beyond the explicit list above. Don't push every audit event.
- **Custom install button via `beforeinstallprompt`** — not portable, and Safari iOS doesn't fire it. Rely on browser-native install UX + iOS-specific text hint.

## Done when

- [x] Manifest reachable at `/manifest.webmanifest` with correct icons, theme_color matches bordeaux brand override. (code path verified; manual browser check pending deploy)
- [ ] App is installable as PWA on Chrome desktop, Chrome Android, and Safari iOS (verified manually with `next dev --experimental-https` for local + a deploy preview for prod-like). Manual install pending deploy.
- [ ] Lighthouse PWA audit passes the installable + manifest checks. Pending deploy.
- [ ] Service worker registers, push subscribe flow completes end-to-end on at least one Chromium browser and one iOS Safari home-screen install. Code path verified; manual E2E pending deploy.
- [x] `notifyUser(...)` replaces `sendTemplated(...)` for the four notifying triggers; both channels fire and stale subscriptions self-cleanup on send failure.
- [x] `npm run verify` green, including new smoke tests.
- [x] PR description cites `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` as the primary reference so the next reader can find the doc that isn't on the public docs site.

## Future iterations (not this one)

- **iter-23b** (potential): per-user channel preferences UI (mute push without unsubscribing entirely).
- Re-evaluate iter-21 (SMS / WhatsApp) only if push + email together still leave a deliverability gap.
