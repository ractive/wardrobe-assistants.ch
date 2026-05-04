---
title: SEO Iteration 2 — Sitemap, robots, structured data
type: iteration
status: planned
order: 2
---

# Iteration 2 — Sitemap, robots, structured data

Technical SEO plumbing. Tells search engines what to crawl and what the business is.

## Scope

- [ ] Create `src/app/sitemap.ts` (Next 16 file convention — generates `/sitemap.xml`)
  - List `/` and any future routes (e.g. `/services` from Iteration 4)
  - Include `lastModified`, `changeFrequency`, `priority`
- [ ] Create `src/app/robots.ts`
  - `allow: '/'`
  - Reference the sitemap URL
- [ ] Add JSON-LD `LocalBusiness` (or `ProfessionalService`) in `src/app/layout.tsx` (reuse the `siteUrl`/`siteName`/`description` constants already defined there for Iter-1's metadata):
  - `name`, `description`, `url`, `email`, `areaServed: CH`
  - `address` (Zürich)
  - `serviceType`: backstage wardrobe / dressing / costume crew
  - `priceRange` (optional, even just `$$` helps)
- [ ] Submit the sitemap to Google Search Console (manual step — document in this iteration)
- [ ] Add Bing Webmaster Tools (optional, low cost)
- [ ] Set up Google Business Profile for the Zürich entity — pairs with the `LocalBusiness` JSON-LD; biggest off-page lever for local search and Maps visibility. Pure marketing task, no code, but track it here so it doesn't get forgotten.
- [ ] Reach out to theatres/festivals already worked with for backlinks ("crew credit" pages, partner lists). For a niche service business this matters more than any on-page tweak.

## Out of scope

- `Service`/`FAQPage` JSON-LD — those go on the deep services page in Iteration 4
- Analytics (separate decision; if added, prefer Plausible or Vercel Analytics over GA4 to avoid cookie banner complexity, ties into legal-compliance-todo)

## Done when

- `/sitemap.xml` and `/robots.txt` return valid content in production
- Google Rich Results Test recognises the LocalBusiness JSON-LD
- Search Console shows the sitemap submitted and accepted
