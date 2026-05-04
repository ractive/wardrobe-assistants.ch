---
title: No-tracking state — current and what triggers re-evaluation
type: note
status: active
order: 101
---

# No-tracking state — current

As of the current iteration, `wardrobe-assistants.ch` runs **without any client-side tracking**. This note exists so the next person to add analytics or a marketing pixel knows what consent surface they are taking on.

## Confirmed clean

- No analytics scripts (no Plausible, no Vercel Analytics, no GA, no Matomo)
- No advertising pixels (no Meta, no LinkedIn, no Google Ads)
- No social embeds (no Twitter / YouTube / Vimeo iframes that set cookies)
- No fonts loaded with tracking — fonts come from `fonts.bunny.net` (privacy-respecting, no cookies, no logging of end users)
- No cookies, no `localStorage`, no `sessionStorage` writes
- No client-side error reporting (no Sentry, no Bugsnag)

The only personal data the platform sees is server access logs at the Bunny.net edge — disclosed in the privacy policy under "Server logs".

## Consent banner: not needed today

Swiss law (FMG Art. 45c) requires informing users about cookies and similar tracking and giving them the chance to refuse. With zero tracking present, there is nothing to inform about beyond the privacy policy already published at `/datenschutz`. No banner is shown, and that is correct.

GDPR applies whenever personal data of individuals located in the EU/EEA is processed — and because a public website is reachable from the EU, EU visitors *will* arrive whether or not they are deliberately targeted. If tracking is added at any point, assume GDPR obligations apply (including opt-in consent where required) unless a documented legal basis says otherwise. The "Swiss-only audience" reading is not a safe default.

## What triggers re-evaluation

Re-open this note before merging any of the following:

- **Cookieless analytics** (Plausible, Vercel Analytics, Cloudflare Web Analytics) — no banner is required, but the privacy policy must mention the processor, the data categories collected and the retention. Update `src/app/(site)/datenschutz/page.tsx` accordingly.
- **Cookie-based analytics** (Google Analytics, Matomo with cookies, Hotjar) — cookie banner with informed consent required *before* the script fires; banner must remember the choice and not load anything until accepted.
- **Marketing pixels** (Meta Pixel, LinkedIn Insight Tag, Google Ads remarketing) — same as cookie analytics; expect a Data Processing Agreement and a Standard Contractual Clauses paragraph in the privacy policy for non-EEA recipients.
- **Embedded video** (YouTube, Vimeo) — use the `*-nocookie.com` variants or load the embed only after a user gesture; otherwise treat as third-party tracking.
- **Newsletter signup** — separate opt-in flow, double opt-in confirmation, dedicated consent record kept by the email provider.
- **Booking forms collecting cast/crew data** — DPA with the form processor, retention policy, and deletion path.

## Implementation reminders

- Do not load tracking scripts in `src/app/layout.tsx` directly. Wrap them in a consent-gated component.
- Server logs at Bunny.net are out of the consent loop — they fall under legitimate-interest processing and are already disclosed.
- Fonts: keep loading from `fonts.bunny.net`. Switching to Google Fonts would re-introduce a third-party leak.

Last reviewed: 2026-05-04
