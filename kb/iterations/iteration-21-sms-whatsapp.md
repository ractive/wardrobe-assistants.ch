---
title: Iteration 21 — SMS + WhatsApp evaluation
type: iteration
order: 22
status: done
---

# Iteration 21 — SMS + WhatsApp evaluation

The original spec said "we'll add an SMS service later" and "evaluate WhatsApp for communication." This iteration is the spike that decides whether either lands and which provider for each.

## Decisions

- **Defer SMS.** Email (iter-20) is sufficient for current squad size; adding a second channel doubles operational surface for marginal benefit.
- **Defer WhatsApp.** Meta template pre-approval and opt-in friction are not worth taking on without a measurable email-deliverability gap.
- **Ship E.164 validation now.** `mobileNumber` validated and normalised via `libphonenumber-js` (default region CH). Full rationale: [notes/sms-whatsapp-evaluation](../notes/sms-whatsapp-evaluation.md).

## Open questions to resolve

- **Trigger surface.** Which existing email sends should also fire SMS / WA? Most obvious: event-assigned notification, message-all-assigned. User decides per-channel or admin decides per-event?
- **Per-user channel preference.** Add a column to `user_profile`? Or a join table for richer preferences?
- **Provider choice — SMS.** Twilio (incumbent), Vonage, Sinch, bunny.net (do they offer SMS? — yes via `BunnyCDN` as of late 2025; check). Cost per SMS to CH numbers is the main sort.
- **Provider choice — WhatsApp.** WhatsApp Business API (Cloud API direct or via Twilio/Vonage/Sinch). Template messages required for opt-in flows.
- **Phone number gathering & validation.** `user_profile.mobileNumber` already exists. Validate format on input (E.164 via `libphonenumber-js`).
- **Cost model.** SMS to CH ~CHF 0.05–0.10 each; WA template messages ~CHF 0.04–0.08 (varies by category). Multiply by squad-size × events × 2-3 reminders → estimate monthly.
- **Compliance.** Swiss telecom rules + WhatsApp's "user-initiated 24-hour window" rules for non-template messages.

## Provisional scope (depending on outcome of evaluation)

**If we go forward with SMS:**
- `lib/sms.ts` matching `lib/email.ts` shape (lazy provider construction, dev console fallback).
- `sendTemplated` extended to dispatch by channel; templates have email + sms variants.
- `mobileNumber` becomes required-on-invite for users who opt into SMS.
- Per-user channel preference (column or join table).

**If we go forward with WhatsApp:**
- `lib/whatsapp.ts` similar shape.
- WA template registry (Meta requires pre-approval of message templates).
- Opt-in flow: user clicks a link → WA chat opens → user sends a "start" message → we mark them as opt-in.

**A `lib/notify.ts` dispatcher**: `notifyUser({ user, eventType, payload })` looks up the user's preferred channel(s) and fans out. Only worth building when we have ≥2 channels live.

## Decision criteria

- SMS: ship if monthly cost stays under [pick budget] and at least one squad member explicitly requests it.
- WhatsApp: ship if Meta's opt-in friction is acceptable AND the deliverability gap vs SMS is meaningful (squad members who consistently miss SMS).

## Out of scope

- **Full multi-channel "preferences" UI** (beyond a single dropdown). Squad members aren't choosing complex policies; they're picking "email or SMS or both."
- **Inbound replies / two-way conversation** — initial scope is outbound-only.

## Done when

- [x] Decision document `kb/notes/sms-whatsapp-evaluation.md` written
- [x] `mobileNumber` validated as E.164 via libphonenumber-js (server schema)
- [x] InviteUserForm placeholder updated to show E.164 example
- [x] Existing tests updated; new schema tests for E.164 added
- [x] Quality gates green
