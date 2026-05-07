---
title: Iteration 20 — Email senders + transactional templates
type: iteration
order: 21
status: planned
---

# Iteration 20 — Email senders + transactional templates

Iter-13 laid the env shape (the `lib/email.ts` wrapper with dev console fallback). Iter-15 + iter-16 + iter-18 each added one-off email sends inline. This iteration consolidates: a templating system, a small library of named templates, and a thin "send the X email to user Y" API for callers.

## Pre-flight

- [ ] iter-15..iter-18 merged. Inline email sends inventoried.
- [ ] Confirm: still Resend, or evaluate alternates (Postmark, SES)?
- [ ] Decide: HTML emails or text-only? (Text-only today; HTML adds template-rendering surface.)

## Provisional scope

- **Template registry** in `apps/admin/src/lib/email-templates.ts` (or `features/<f>/server/email-templates.ts` if feature-owned):
  ```ts
  export const emailTemplates = {
    userInvited: (params: { recipientName: string; setPasswordUrl: string }) => ({...}),
    userMessageFromAdmin: (params: { ... }) => ({...}),
    eventAssigned: (params: { eventName, eventDate, eventVenue, recipientName }) => ({...}),
    eventMessage: (params: { ... }) => ({...}),
    requestParticipationToAdmin: (params: { ... }) => ({...}),
  } satisfies Record<string, (params: unknown) => SendEmailInput>
  ```
- **Higher-level send API**:
  ```ts
  await sendTemplated("eventAssigned", { recipientName, eventName, ... })
  ```
  Looks up the template, renders, calls `sendEmail`.
- **HTML rendering**. If we go HTML, two options:
  - JSX-rendered templates via `@react-email/render` + `@react-email/components`.
  - Plain `text` only, defer HTML until a real need arises.
  Recommend: **start text-only**, add HTML only when one specific email needs it.
- **Localisation**. Today the squad members are presumably DE/EN bilingual. Single-language emails for now (English); revisit with the multilingual iteration (iter-5, deferred).
- **Audit trail of email sends**. Either a per-email log table or hook into a future `lib/audit.ts`. Decide at impl time.
- **Deliverability hardening**. Iter-9's runbook noted SPF/DKIM/DMARC are already set up via Resend. Verify still passing on a test send.

## Out of scope

- **Newsletter / broadcast email** — only transactional in this iter.
- **Bounce handling / reputation tracking** — Resend dashboard suffices for now.
- **Per-user email preferences (opt-out)** — admin/squad emails are operational; legal/regulatory category, not marketing.

## Done when

- [ ] Every iter-15/16/18 inline email send replaced by a `sendTemplated(...)` call.
- [ ] Templates colocated and tested (snapshot tests OK).
- [ ] `npm run verify` green.
