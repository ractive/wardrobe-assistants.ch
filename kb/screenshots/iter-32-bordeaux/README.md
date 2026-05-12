# iter-32 bordeaux baseline screenshots

Visual baseline for the bordeaux admin theme that landed in
[iter-32](../../iterations/iteration-32-admin-bordeaux-theme.md). Captured as
part of [iter-38 §C](../../iterations/iteration-38-iter-32-verification-debt.md)
verification debt.

## Status

**Deferred — PNG capture not yet performed.** The autonomous `/ralph-loop`
that landed iter-38 cannot launch a running admin instance, so §C is queued
as a manual follow-up. The §E manual-verification checklist
(`kb/audits/iter-38-manual-verification.md`) tracks completion.

## Intent

These are **baselines**, not assertions — they exist so future iterations
have a visual-diff target if the bordeaux palette drifts. They are not run
in CI.

## Capture procedure

- Tool: `ff-rdp` (Firefox remote-debug screenshot primitive).
- Viewport: **1024px** desktop only. Mobile (375px) baseline can land in a
  follow-up if visual drift is suspected on narrow viewports.
- One PNG per page per mode → ~20 PNGs total.
- Output: `light/<slug>.png` and `dark/<slug>.png`.

## Page list

| Route                         | Slug                  |
| ----------------------------- | --------------------- |
| `/`                           | `dashboard.png`       |
| `/bookings`                   | `bookings.png`        |
| `/bookings/<sample-id>`       | `bookings--detail.png`|
| `/bookings/new`               | `bookings--new.png`   |
| `/services`                   | `services.png`        |
| `/users`                      | `users.png`           |
| `/my-bookings`                | `my-bookings.png`     |
| `/my-bookings/<sample-id>`    | `my-bookings--detail.png` |
| `/login`                      | `login.png`           |
| `/set-password`               | `set-password.png`    |
| `/offer/<sample-token>`       | `offer-token.png`     |

## Naming convention

- Use `--` (double dash) as a route-segment separator inside the filename
  (e.g. `bookings--detail.png`).
- Lower-kebab-case throughout.
- No timestamps or capture metadata in the filename (those go in git
  history; the filename names the *page*, not the *run*).
