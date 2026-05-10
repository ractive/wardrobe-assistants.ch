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

## Decisions (confirmed pre-iter-20)

- **Transport: keep Resend.** No re-evaluation of Postmark/SES; SPF/DKIM/DMARC are already in place from iter-9.
- **Authoring: local `react-email`, not Resend hosted templates.** Templates live in the repo as JSX, rendered with `@react-email/render`, sent through Resend as plain `html` + `text`. Reasons:
  - Typed params, version control, code review, snapshot tests in `verify` — everything dashboard editors lose.
  - `@react-email/components` solves the cross-client compatibility headache (Outlook MSO, table layouts) so we write JSX, not hand-rolled `<table>` HTML.
  - Resend's hosted templates are a dashboard with `{{variable}}` interpolation — useful for non-dev copy edits, which we don't have. Not worth the env-parity / version-control loss.
- **HTML, not text-only.** With `react-email` the HTML path is the default-easy one; `render()` returns both HTML and a plaintext fallback in a single call, so the plain-text variant comes for free.

## Scope

- **Template modules** in `apps/admin/src/lib/email-templates/<key>.tsx`, one JSX component per template, default-exported alongside a typed `Params` type:
  ```tsx
  // apps/admin/src/lib/email-templates/event-assigned.tsx
  import { Html, Body, Container, Heading, Text, Link } from "@react-email/components";

  export type EventAssignedParams = {
    recipientName: string;
    eventName: string;
    eventDate: string;
    eventVenue: string;
    eventUrl: string;
  };

  export default function EventAssigned(p: EventAssignedParams) {
    return (
      <Html>
        <Body>
          <Container>
            <Heading>You've been assigned to {p.eventName}</Heading>
            <Text>Hi {p.recipientName},</Text>
            <Text>{p.eventDate} at {p.eventVenue}.</Text>
            <Link href={p.eventUrl}>Open event</Link>
          </Container>
        </Body>
      </Html>
    );
  }
  ```
- **Template registry** in `apps/admin/src/lib/email-templates/index.ts` — maps template keys to `{ component, subject }` pairs. The registry is the single typed surface callers use; individual `.tsx` files are implementation detail.
- **Higher-level send API** in `apps/admin/src/lib/email.ts`:
  ```ts
  await sendTemplated("eventAssigned", to, { recipientName, eventName, ... })
  ```
  Looks up the template, runs `render(<Component {...params} />)` → `{ html, text }`, calls Resend with subject + both bodies. Type-safe per template key (params validated at the call site).
- **Batch sending** via Resend's batch API (`POST /emails/batch`, up to 100 emails per call — see https://resend.com/docs/dashboard/emails/batch-sending). Add `sendTemplatedBatch("eventAssigned", recipients[])` for the "message all assigned" path (iter-16/iter-18). Same template, per-recipient param interpolation, one HTTP round-trip. Keep the single-recipient `sendTemplated` for everything else.
- **Localisation**. Single-language for now (English); revisit with the multilingual iteration (iter-5, deferred).
- **Audit trail of email sends**. Either a per-email log table or hook into a future `lib/audit.ts`. Decide at impl time.
- **Sender address rename: `hello@` → `info@`.**
  - Replace every occurrence of `hello@wardrobe-assistants.ch` with `info@wardrobe-assistants.ch` across `apps/admin/` and `apps/homepage/`. Known call sites at planning time (re-grep at impl):
    - `apps/homepage/src/app/site-config.ts` (`contactEmail`)
    - `apps/homepage/src/components/Footer.tsx` (`mailto:` + visible text)
    - `apps/homepage/src/app/(site)/page.tsx` (CTA `mailto:`)
    - `apps/admin/src/lib/env.test.ts` (`EMAIL_FROM` test fixture, currently `admin@…`)
    - `apps/admin/.env.example` (`EMAIL_FROM` default, currently `admin@…`)
  - **Don't touch `kb/iterations/done/iteration-06-legal-compliance.md`** — historical record.
  - **Production env update:** `EMAIL_FROM` for the admin app is injected via bunny Magic Container env, not the repo. Rotate via `hoppy template env --update` (per the iter-13 pattern in `kb/admin-architecture/decision-log.md`). Set to: `Wardrobe Assistants <info@wardrobe-assistants.ch>`.

- **Deliverability hardening — investigate why current sends land in spam.**
  Iter-9 set up Resend's SPF/DKIM/DMARC, but real-world sends from `info@wardrobe-assistants.ch` are hitting Gmail/Outlook spam folders. Diagnostic steps in order:
  1. **Run https://mail-tester.com on a test send** to get a numeric score and a per-check breakdown. Drives the rest of the list.
  2. **Verify DKIM alignment.** `dig +short TXT resend._domainkey.wardrobe-assistants.ch` should return Resend's DKIM record (currently `lifecycle.ignore_changes = all` in `infra/terraform/dns.tf` — managed via the Resend dashboard). Confirm the `d=` tag in headers of a real send aligns with `wardrobe-assistants.ch`.
  3. **Verify SPF chain.** Apex SPF currently does **not** exist (only `send.wardrobe-assistants.ch` has SPF, used by Resend's MAIL FROM envelope). Once apex SPF lands for ImprovMX (below), `dig +short TXT wardrobe-assistants.ch` must return exactly one TXT starting with `v=spf1` — multiple SPF records = automatic spam.
  4. **Tighten DMARC.** Current policy is `v=DMARC1; p=none;` (audit-only) and has **no `rua=` reporting address** — no signal on real failures. Stage progression:
     - First: add `rua=mailto:dmarc-reports@wardrobe-assistants.ch` (use ImprovMX to forward) and let it run for a week.
     - Then: tighten to `p=quarantine; pct=25;` and observe.
     - Eventually: `p=reject` once reports are clean.
  5. **Check sender-name reputation.** `From:` display name should be `Wardrobe Assistants <info@…>` (current `EMAIL_FROM`), not bare `info@…` — increases trust signal.
  6. **`List-Unsubscribe` header on bulk sends.** Resend supports it; required by Gmail/Yahoo for bulk senders.
  7. **HTML + plaintext both present.** Already enforced by `react-email`'s `render()` — verify the Resend send call passes both.
  8. **Body-content lint.** Avoid: shouty subject lines, single giant image, lots of links to short-lived URLs, excessive emoji. Templates land in iter-20 — bake the rules into the template-author checklist.

- **`info@` inbound forwarding via ImprovMX.** Account already created. Required apex DNS records (add to `infra/terraform/dns.tf` — both go on the apex; do **not** disturb the existing `send.*` Resend records):
  - **MX `wardrobe-assistants.ch` priority 10** → `mx1.improvmx.com.`
  - **MX `wardrobe-assistants.ch` priority 20** → `mx2.improvmx.com.`
  - **TXT `wardrobe-assistants.ch`** → `v=spf1 include:spf.improvmx.com ~all`
    - Note: only **one** apex SPF record allowed by RFC 7208. Resend's MAIL FROM envelope uses `send.wardrobe-assistants.ch` (its own SPF lives there), so the apex SPF only needs ImprovMX. If we ever switch Resend to apex MAIL FROM, this record must be merged: `v=spf1 include:_spf.resend.com include:spf.improvmx.com ~all`.
  - Terraform sketch (no `lifecycle.ignore_changes` since these are not dashboard-managed):
    ```hcl
    resource "bunnynet_dns_record" "improvmx_mx_1" {
      zone     = bunnynet_dns_zone.wardrobe_assistants_ch.id
      type     = "MX"
      name     = ""
      value    = "mx1.improvmx.com"
      priority = 10
      ttl      = 0
    }
    resource "bunnynet_dns_record" "improvmx_mx_2" {
      zone     = bunnynet_dns_zone.wardrobe_assistants_ch.id
      type     = "MX"
      name     = ""
      value    = "mx2.improvmx.com"
      priority = 20
      ttl      = 0
    }
    resource "bunnynet_dns_record" "apex_spf_txt" {
      zone  = bunnynet_dns_zone.wardrobe_assistants_ch.id
      type  = "TXT"
      name  = ""
      value = "v=spf1 include:spf.improvmx.com ~all"
      ttl   = 0
    }
    ```
  - **Verification**: `dig MX wardrobe-assistants.ch` returns the two ImprovMX hosts; `dig TXT wardrobe-assistants.ch` returns exactly one SPF TXT; ImprovMX dashboard reports both as ✓; send a test mail to `info@wardrobe-assistants.ch` and confirm it arrives at the configured destination mailbox.
  - **`hoppy` runbook update**: document the apex MX + apex SPF in `kb/runbooks/` so the next operator knows ImprovMX (apex) and Resend (`send.*` subdomain) coexist by design.

- **Preview workflow**. `npx react-email dev` runs a local preview server reading `apps/admin/src/lib/email-templates/`. Document in the README; not part of `verify`.

## Out of scope

- **Newsletter / broadcast email** — only transactional in this iter.
- **Bounce handling / reputation tracking** — Resend dashboard suffices for now.
- **Per-user email preferences (opt-out)** — admin/squad emails are operational; legal/regulatory category, not marketing.

## Done when

- [ ] Every iter-15/16/18 inline email send replaced by a `sendTemplated(...)` call.
- [ ] Bulk sends ("message all assigned") use `sendTemplatedBatch(...)` (Resend batch API).
- [ ] Templates colocated as `.tsx` and tested (snapshot tests on the rendered HTML + text).
- [ ] All `hello@wardrobe-assistants.ch` references replaced with `info@wardrobe-assistants.ch` (homepage + admin); production `EMAIL_FROM` rotated via `hoppy template env --update` to `Wardrobe Assistants <info@wardrobe-assistants.ch>`.
- [ ] ImprovMX apex MX + SPF terraformed and applied; `dig MX/TXT` matches; `info@` test mail forwards to the destination mailbox.
- [ ] DMARC `rua=` reporting address added; mail-tester score recorded in PR description; documented baseline + improvements.
- [ ] `npm run verify` green; `npm run verify:tf` green for the terraform changes.
