---
title: SEO Iteration 2 — Sitemap, robots, structured data
type: iteration
status: done
order: 2
---

# Iteration 2 — Sitemap, robots, structured data

Technical SEO plumbing. Tells search engines what to crawl and what the business is.

## Scope

- [x] Create `src/app/sitemap.ts` (Next 16 file convention — generates `/sitemap.xml`)
  - List `/` and any future routes (e.g. `/services` from Iteration 4)
  - Include `lastModified`, `changeFrequency`, `priority`
- [x] Create `src/app/robots.ts`
  - `allow: '/'`
  - Reference the sitemap URL
- [x] Add JSON-LD `LocalBusiness` (or `ProfessionalService`) in `src/app/layout.tsx` (reuse the `siteUrl`/`siteName`/`description` constants already defined there for Iter-1's metadata):
  - `name`, `description`, `url`, `email`, `areaServed: CH`
  - `address` (Zürich)
  - `serviceType`: backstage wardrobe / dressing / costume crew
  - `priceRange` (optional, even just `$$` helps)
- [x] Document manual off-code follow-ups (GSC, Bing, Google Business Profile, backlink outreach) — see "Manual SEO submission steps" below; these run after code lands in production and are tracked separately from the code scope.

## Out of scope

- `Service`/`FAQPage` JSON-LD — those go on the deep services page in Iteration 4
- Analytics (separate decision; if added, prefer Plausible or Vercel Analytics over GA4 to avoid cookie banner complexity, ties into legal-compliance-todo)

## Done when

- `/sitemap.xml` and `/robots.txt` return valid content in production
- Google Rich Results Test recognises the LocalBusiness JSON-LD
- Search Console shows the sitemap submitted and accepted

## Manual SEO submission steps (off-code)

These tasks are tracked here so they don't get lost. They run after the code lands in production.

### Google Search Console

1. Sign in to <https://search.google.com/search-console> with the wardrobe-assistants Google account.
2. Add a new property of type **Domain** (`wardrobe-assistants.ch`). Domain verification is preferred over URL-prefix because it covers `https://`, `http://`, `www.`, and any future subdomains in one go.
3. Verify ownership via DNS TXT record on the bunny.net DNS zone — paste the `google-site-verification=...` TXT record into bunny DNS, wait for propagation, click **Verify**.
4. Once verified, go to **Sitemaps** → submit `https://wardrobe-assistants.ch/sitemap.xml`.
5. Trigger a fetch on the homepage via **URL Inspection** → **Request indexing** to push the first crawl rather than waiting for the natural cycle.
6. Confirm via the **Rich Results Test** (<https://search.google.com/test/rich-results>) that the `ProfessionalService` JSON-LD is recognised — paste `https://wardrobe-assistants.ch/` and check that the business entity is detected without errors.

### Bing Webmaster Tools (optional)

1. Sign in to <https://www.bing.com/webmasters> with the same Google account (Bing supports Google sign-in) or a Microsoft account.
2. **Import from Google Search Console** — Bing reuses the GSC verification, so this is one click once GSC is set up.
3. Submit the same sitemap URL under **Sitemaps**.

### Google Business Profile (Zürich)

1. Sign in to <https://business.google.com/> with the wardrobe-assistants Google account.
2. Create a profile with:
   - Business name: `Wardrobe Assistants`
   - Category: primary `Costume Rental Service` or `Wardrobe Service`; secondary `Dry Cleaner`/`Tailor` if Google offers them
   - Service area business (no public storefront): pick **I deliver goods and services to my customers** and define service areas (Zürich + canton of Zürich, expand as appropriate)
   - Address: Zürich (use the same locality as the JSON-LD `address`)
   - Phone, website (`https://wardrobe-assistants.ch`), email
3. Verify via postcard to the registered address (Google's standard for service-area businesses); takes ~5–14 days.
4. After verification, ensure **services** listed match the JSON-LD `serviceType` array — quick changes, ironing & steam, repairs & alterations, wigs & accessories, load-in/out, laundry.

### Backlink outreach (manual, ongoing)

Track in a separate doc; reach out to theatres/festivals/agencies the crew has already worked with to be listed on their "crew credits" or "partner" pages. One credible niche-relevant backlink moves the needle more than any on-page tweak for a Swiss service business.
