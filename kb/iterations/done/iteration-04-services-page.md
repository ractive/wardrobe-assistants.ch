---
title: SEO Iteration 4 — Services deep page + FAQ
type: iteration
status: done
order: 4
---

# Iteration 4 — Services deep page + FAQ

The substantive content page that targets the actual queries people search. Homepage stays slim; this page does the heavy lifting for indexing.

## Target queries (research/draft)

EN: "wardrobe assistant Switzerland", "tour wardrobe crew", "backstage dresser", "theatre wardrobe team", "festival wardrobe crew Zürich", "quick change dresser hire"
DE (for later multilingual iteration, but keep in mind): "Garderobenassistent", "Garderobiere Theater", "Ankleider Tournee", "Kostümbetreuung Schweiz"

## Scope

- [x] New route `src/app/(site)/services/page.tsx` — chose `/services` (matches existing `#services` anchor, primary nav target)
- [x] Page-level `metadata` export (title, description, canonical, OG image override)
- [x] Content structure:
  - H1 with primary keyword
  - Intro paragraph (~150 words) explaining who we are and where we work
  - Six H2 sections — one per service (quick changes, ironing & steam, repairs & alterations, wigs & accessories, load-in/out, laundry) — each 150–300 words covering process, equipment, when it matters, a real example
  - "Where we work" section — theatres, concerts, festivals, with location signals (Zürich, broader CH)
  - FAQ section with 8–12 Q&A pairs (e.g. "How far in advance should we book?", "Do you travel with the production?", "Can you handle period costumes?", "What's the team size for a typical run?")
  - CTA back to `/#contact` or directly to mailto
- [x] JSON-LD on this page:
  - `Service` × 6 (one per offering)
  - `FAQPage` covering the FAQ section
- [x] Internal link from homepage hero/services section to this page (e.g. "See full services →" link, in addition to the in-page anchor)
- [x] Add the new route to `sitemap.ts` (built in Iteration 2)

## Copy guidelines

- Tone matches the homepage: professional with flair, concrete actions over theatrical language.
- No keyword stuffing — write for humans. Search engines reward content that reads naturally.
- Use semantic HTML: `<article>`, `<section>`, `<h2>`/`<h3>`, `<dl>` for FAQ if appropriate (or simple H3+P pairs).

## Out of scope

- DE/FR/IT translations (later iteration)
- Case studies / portfolio gallery (would be its own iteration)
- Blog / news section

## Done when

- The page is live, indexable, internally linked from the homepage
- Google Rich Results Test recognises Service and FAQPage schemas
- Lighthouse SEO score on the page is ≥95
