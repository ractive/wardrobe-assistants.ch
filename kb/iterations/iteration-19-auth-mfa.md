---
title: Iteration 19 — Auth/MFA story (admin TOTP, password rules, dev bootstrap)
type: iteration
order: 20
status: planned
---

# Iteration 19 — Auth/MFA story

Deferred from iter-13 and iter-15 explicitly. This is the iteration that designs the user / password / MFA flow holistically — for admins (TOTP required), squad members (no MFA), and the dev-bootstrapping experience that needs to coexist with both.

## Open questions to resolve before scoping

- **Admin MFA enforcement.** TOTP required at every admin sign-in, or once per session, or once-per-device? Better Auth's `twoFactor` plugin needs a configuration choice.
- **Admin enrolment trigger.** Forced at first sign-in (interrupt UX) vs forced before reaching first admin-only page (gentler) vs explicit invite-flow step (cleanest)?
- **Backup codes.** How many, where displayed, can the admin regenerate themselves?
- **Password rules.** Min length, complexity, breach check (haveibeenpwned API), reuse-prevention against history?
- **"Set your password" flow vs "reset password" flow.** Iter-15 uses BA's reset-password as the invite mechanism. Is that still the right shape, or do we want a dedicated invite-token table?
- **Recovery flows.** What happens when an admin loses their TOTP? Backup codes only? Admin-to-admin reset? Email-link-to-bypass-MFA (security risk)?
- **Squad-member sign-up self-service.** Spec says they're invited only — confirm? What if a squad-member loses their device — admin-driven reset only?
- **Dev bootstrap.** iter-13 ships `db:reset:admin` with default email/password. Should it skip TOTP? Pre-enrol with a known-fixed TOTP secret (so dev can sign in repeatably)? Or accept that dev sign-in requires a one-time TOTP-app setup?

## Scope (provisional — subject to grilling at iteration kickoff)

- Better Auth `twoFactor` plugin configured per the chosen enforcement model.
- A `requireMFA` middleware that gates `/users`, `/events`, `/services` for admins until enrolled.
- Backup-codes UI: download a printable list once at enrolment, cannot retrieve later.
- Password rules in `lib/permissions.ts` or a new `lib/auth-policy.ts` (zod schema for password — used in invite flow + reset flow + sign-up).
- Recovery: admin-to-admin TOTP reset (one ADMIN can reset another ADMIN's TOTP; logged in audit). No email-link bypass.
- Dev bootstrap: `db:reset:admin` skips MFA enrolment when `NODE_ENV=development`; `npm run dev:admin` lands on dashboard without TOTP for the seeded admin only. (Real admins enrol on first sign-in in prod.)

## Out of scope

- **WebAuthn / passkeys** — TOTP first, passkeys when there's a clear motivator.
- **SSO / SAML / OIDC** — single-tenant internal app, no clear demand.
- **Per-action MFA re-prompts** (e.g. "confirm TOTP before deleting a user") — not in spec.

## Done when

(Filled in at iteration kickoff after the open questions are grilled.)
