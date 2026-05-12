---
title: Permission gating UI
type: architecture
status: current
---

# Permission gating

Server `<HasPermission perm="…">` is the **authoritative** gate — it runs in the RSC and refuses to render the children if the user lacks the permission. Client-side `useHasPermission("…")` is a **UI hint only**: it hides a menu item or disables a button to keep the surface tidy, but server actions and queries each gate independently via `withPermission` (see [`auth-and-permissions.md`](../auth-and-permissions.md)).

Permission keys are entity-scoped:

| Key shape | Use | Examples |
|---|---|---|
| `<ENTITY>_VIEW` | Reads (list, detail) | `BOOKING_VIEW` |
| `<ENTITY>_CREATE` | Creates | `BOOKING_CREATE`, `SERVICE_CREATE` |
| `<ENTITY>_UPDATE` | Updates | — |
| `<ENTITY>_DELETE` | Deletes | `BOOKING_DELETE`, `USER_DELETE` |
| `<ENTITY>_<ACTION>` | Domain verbs | `USER_INVITE`, `USER_MESSAGE`, `BOOKING_ASSIGN`, `BOOKING_OFFER_SEND` |

**Never reuse a write permission to gate a read.** F-FE-08 records the precedent: a write permission was used to gate a detail page, which silently hid the entity from users who could legitimately *view* it. The fix is a dedicated `<ENTITY>_VIEW`.

**Mobile-first answer:** identical to desktop — gates run on the server.

**Desktop answer:** identical.

**Don't:**
- Branching on `role` directly — use the permission catalog.
- Client-side `useHasPermission` as the only gate — server-side `<HasPermission>` or `withPermission` is required for anything that fetches or mutates data.
- Reusing a write permission as a view gate.

---

See also: [design-system index](README.md) · [auth-and-permissions](../auth-and-permissions.md)
