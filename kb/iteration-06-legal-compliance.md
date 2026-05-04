---
title: Iteration 6 — Swiss legal compliance (Impressum + privacy + AGB)
type: iteration
status: planned
order: 6
---

# Iteration 6 — Swiss legal compliance

What a Swiss commercial website actually needs to be legal. Lighter than EU/GDPR in some respects, stricter in others. This iteration covers the bare-minimum legal surface for `wardrobe-assistants.ch` as a service business based in Zürich.

## Legal context (Swiss law as of 2026)

Three laws drive the requirements:

1. **UWG (Federal Act Against Unfair Competition)** Art. 3(1)(s) — requires identification of the operator on any commercial website. This is the *Impressum* obligation. Applies to anyone offering services or selling online, regardless of company form (incl. sole proprietors).
2. **revFADP / nDSG (revised Federal Act on Data Protection)** — in force since 1 September 2023. Replaced the old DSG. Closer to GDPR but not identical. Triggered by *any* processing of personal data, including server logs and email replies.
3. **FMG/TCA Art. 45c (Telecommunications Act)** — covers cookies and similar tracking: requires *informing* users and allowing refusal. Notably **does not require explicit opt-in** like GDPR — Swiss-only sites can use a notice/banner with an opt-out approach. *However*, if EU residents are part of the audience, GDPR applies extraterritorially and explicit opt-in becomes safer.

There is **no** Swiss-equivalent of cookie-banner-mandate-for-everyone. If the site uses no cookies and no analytics, no banner is needed at all.

## Required pages

### Impressum (legally mandatory)

Add a route like `/impressum` (or `/legal`) with at minimum:

- Legal name of the operator (sole proprietor full name *or* company name as registered)
- Postal address (must be a real address — PO box not sufficient)
- Email address (already published — `hello@wardrobe-assistants.ch`)
- Phone number (recommended, not strictly required for non-corporate operators)
- For registered entities: **UID number** (`CHE-xxx.xxx.xxx`) and Commercial Register entry reference
- For VAT-registered entities: **VAT number** (`CHE-xxx.xxx.xxx MWST`)

For a sole proprietor under the threshold (CHF 100'000 turnover) with no Handelsregister entry, the UID/VAT lines are omitted — full legal name + address + email is enough.

Link to the Impressum from the **footer of every page**.

### Privacy policy / Datenschutzerklärung (mandatory the moment any personal data is processed)

Triggered already because:

- The site logs IPs via Bunny.net (server logs = personal data under revFADP)
- Email replies contain personal data
- Any future contact form, analytics, or newsletter expands the surface

Required content under revFADP Art. 19:

- Identity and contact details of the controller (links back to Impressum)
- Purposes of processing (e.g. responding to enquiries, hosting, security/abuse logs)
- Categories of personal data collected (name, email, IP, browser metadata)
- Recipients of data — including processors (Bunny.net, email provider, any future analytics)
- Cross-border transfers — Bunny.net infrastructure spans EU; disclose this and the legal basis (adequacy + standard contractual clauses)
- Data retention periods
- Data subject rights: access, rectification, deletion, restriction, data portability, objection
- Right to lodge a complaint with the **FDPIC** (Eidg. Datenschutz- und Öffentlichkeitsbeauftragte / EDÖB)
- Date of last update

Plain-language style is required. Templates exist (datenschutzpartner.ch, KMU-portal templates) but must be adapted to the actual processing — generic templates that mention services not actually used are worse than no policy.

Link to the privacy policy from the **footer of every page**.

### AGB / Terms of Service (recommended, not mandatory)

For a service business doing tour/event work, a short AGB/T&Cs document is worth having to define:

- Scope of services
- Booking and cancellation terms
- Payment terms (deposit, final invoice, currency)
- Liability limitations (within Swiss CO limits)
- Force majeure (relevant for tours)
- Applicable law (Swiss) and jurisdiction (Zürich)

Not required to be linked from every page; usually referenced when sending quotes/contracts.

## Cookie / tracking consent

Current state: **no cookies, no analytics, no third-party scripts** → no banner needed. Document this finding so any future addition triggers re-evaluation.

If analytics is added later (recommended Plausible or Vercel Analytics — both cookieless and Swiss/EU-friendly):

- Plausible / Vercel Analytics → no cookie consent required, just disclose in privacy policy
- Google Analytics / Meta Pixel / similar → cookie banner with informed consent required (the banner must work *before* the script fires)

## Implementation scope

- [ ] Decide and document the legal entity (sole proprietor name, registered company, etc.) — precondition for the Impressum
- [ ] Confirm whether the entity is in the Commercial Register (UID-CHE) and VAT-registered (MWST)
- [ ] Confirm the postal address that can be published
- [ ] Create `src/app/(site)/impressum/page.tsx` with the required identification fields
- [ ] Create `src/app/(site)/datenschutz/page.tsx` (or `/privacy`) with the privacy policy — adapted from a Swiss template, edited to match actual processing (Bunny.net hosting, email, no analytics yet)
- [ ] Add footer links to both pages from `src/components/Footer.tsx`
- [ ] Update sitemap (Iteration 2) to include both legal pages
- [ ] Make sure both pages are indexable (no `noindex`) — they should be discoverable
- [ ] (Optional) Draft AGB as a separate document, kept in `kb/` until referenced from the site or quotes
- [ ] Document the no-tracking state so any future analytics work knows to revisit consent

## Out of scope

- GDPR-specific opt-in cookie banner — only needed if/when explicit EU targeting starts and tracking cookies are added
- Accessibility (WCAG / EAA) — separate concern; worth its own iteration
- Newsletter / marketing email opt-in — only if a newsletter is launched

## Done when

- `/impressum` and `/datenschutz` are live and linked from the footer on every page
- Both pages contain accurate, current information specific to this operator (not template boilerplate)
- A documented decision exists about the legal entity and registration status
- Sitemap includes both pages

## References

- revFADP (DSG) full text: fedlex.admin.ch
- FDPIC guidance: edoeb.admin.ch
- UWG Art. 3(1)(s): fedlex.admin.ch
- FMG Art. 45c (cookies): fedlex.admin.ch
