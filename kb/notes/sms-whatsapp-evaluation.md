---
title: SMS + WhatsApp evaluation — iter-21 spike outcome
type: note
status: active
tags: [sms, whatsapp, notifications, channels, evaluation, deferred]
order: 102
---

# SMS + WhatsApp evaluation — iter-21 spike outcome

Evaluated in iter-21. Outcome recorded here so the next person to revisit doesn't re-run the same analysis.

## Decisions

- **Defer SMS.** Email (iter-20) is sufficient for current squad size. Adding a second channel doubles operational surface for marginal benefit until at least one squad member explicitly requests it.
- **Defer WhatsApp.** Meta template pre-approval and opt-in friction are not worth taking on without a measurable email-deliverability gap.
- **Ship E.164 validation now.** `mobileNumber` in `inviteUserInput` is validated and normalised to E.164 via `libphonenumber-js` (default region: CH). Data is clean for whenever SMS ships.

## Trigger surface mapping

The following existing email sends are natural SMS / WA candidates when re-evaluated. Cross-references iter-20's provisional template registry.

| Template key (iter-20) | Trigger | SMS candidate? | Notes |
|---|---|---|---|
| `eventAssigned` | Admin assigns squad member to event | Yes — time-sensitive | Would fire on same trigger |
| `userMessageFromAdmin` | "Message all assigned" from event detail | Yes | Bulk send; per-user channel preference needed |
| `requestParticipationToAdmin` | Squad member requests participation via iter-18 flow | No — admin-facing | Admin uses web app; SMS adds little value |
| `userInvited` | First invite to new user | No | Sent before user can opt in to SMS |

When a `lib/notify.ts` dispatcher is built (see iter-21 scope), it routes by `user_profile.notificationChannel` and fans out across active channels.

## Per-user channel preference design (deferred)

**Recommended column:** add `notificationChannel` enum to `user_profile`:

```ts
// packages/db/src/schema/users.ts
notificationChannel: text("notification_channel")
  .notNull()
  .default("email")
  .$type<"email" | "sms" | "email_and_sms">()
```

Rationale for a single column over a join table: the product question is "email or SMS or both" — not a policy-rich multi-channel decision tree. A join table adds joins, migrations, and query complexity for no product benefit at this scale.

**WhatsApp** would need a separate boolean column `whatsappOptIn` (or `notificationChannelWa`). Meta's 24-hour window and template rules mean WA opt-in is a distinct user action, not just a channel checkbox on the invite form. Don't fold WA into `notificationChannel` enum.

## SMS provider shortlist

| Provider | Price to CH | Data residency | Notes |
|---|---|---|---|
| **ASPSMS** | ~CHF 0.06/SMS | Switzerland | Swiss-domiciled; simpler compliance story; straightforward REST API |
| Twilio | ~CHF 0.07/SMS | US (SCCs available) | Incumbent choice; strong CH coverage; more complex compliance paperwork |
| Vonage | ~CHF 0.07–0.08/SMS | US/EU | Reliable but no CH-residency advantage |

**Clarification on bunny.net:** bunny.net does NOT offer SMS. The iter-21 plan speculated "BunnyCDN SMS as of late 2025" — this is incorrect. bunny.net's product surface is CDN, storage, stream, and DNS. Remove this from consideration.

**Recommended pick when SMS ships: ASPSMS.** Swiss-domiciled provider reduces GDPR/DSG data-transfer complexity and aligns with the project's Swiss-first stance. Twilio as fallback if ASPSMS coverage proves insufficient.

## WhatsApp provider shortlist

| Provider | Cost per template msg | Notes |
|---|---|---|
| Meta Cloud API (direct) | Free tier, then per-message | Template-approval ops overhead; direct Meta dependency |
| **Twilio WA** | ~CHF 0.05–0.08 | Same SDK shape as Twilio SMS; simpler dev path |

**Recommended pick when WA ships: Twilio WA.** If SMS eventually ships via Twilio as well, a single vendor and SDK handles both channels, reducing integration surface. The free-tier argument for Meta Cloud API does not outweigh the ops overhead at this squad size.

## Cost model

Back-of-envelope for 1 squad of 8 members × 4 events/month × 2 reminders/event:

```
8 members × 4 events × 2 reminders = 64 SMS/month
64 × CHF 0.06 (ASPSMS) = CHF 3.84/month
64 × CHF 0.07 (Twilio)  = CHF 4.48/month
```

WA template messages are similar. **Cost is not the blocker.** The blocker is operational surface: template approval workflows, opt-in flows, provider onboarding, and the ongoing support burden of a second notification channel for a tool used by a small, tech-comfortable squad.

## Compliance notes

**Swiss telecom (revFMG / TCG):** Outbound transactional SMS to a user who provided their mobile number at signup (the `mobileNumber` field on invite) is permissible as operational communication. No unsolicited marketing. The mobile number field on the invite form already signals voluntary provision.

**WhatsApp (Meta rules):** The first outbound message to a user must be a pre-approved template message. After the user sends any message in reply, a 24-hour "user-initiated window" opens for free-form messages. For a squad notification tool, every outbound is a template (event reminders, assignments) — the 24-hour window is irrelevant unless we build two-way chat. The real cost is the template-approval process and the opt-in flow: user must initiate contact (e.g. click a link → WA opens pre-filled → user sends "Start") before we can message them.

## What we ship in iter-21

- E.164 validation in `inviteUserInput` (schema refinement + transform, default region CH).
- Updated `InviteUserForm` placeholder: `"+41 79 123 45 67"`.
- New schema tests covering valid Swiss formats, normalisation, and rejection cases.

## Re-evaluation trigger

Re-open when:
- At least one squad member explicitly requests SMS notifications, **or**
- Iter-20 email-deliverability data shows a measurable gap (bounces, unread rates).

Last reviewed: 2026-05-10
