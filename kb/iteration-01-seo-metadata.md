---
title: SEO Iteration 1 — Metadata, OG image, social cards
type: iteration
status: planned
order: 1
---

# Iteration 1 — Metadata, OG image, social cards

Smallest, fastest SEO win. Make the site shareable on Slack/WhatsApp/LinkedIn and give Google + crawlers a proper title/description to index.

## Scope

- [ ] Set `metadataBase` in `src/app/layout.tsx` to the production URL (`https://wardrobe-assistants.ch`)
- [ ] Add a `metadata` export with:
  - `title` template `"%s | Wardrobe Assistants"` and a default homepage title (≤60 chars, includes a primary keyword)
  - `description` 140–160 chars, action-oriented
  - `openGraph` block: title, description, url, locale (`en_CH` for now), siteName, image (1200×630)
  - `twitter` card type=`summary_large_image`
  - `alternates.canonical` per page
- [ ] Set `<html lang="en">` (already correct — verify only)
- [ ] Create the OG image:
  - Crop a 1200×630 focal region from `public/background.png` (or generate a stylised composition with brand colours + tagline)
  - Export both `.png` (Twitter/legacy) and `.webp`
  - Place at `public/og-image.png` and reference in `metadata.openGraph.images`
- [ ] Add favicon set: 32×32 PNG, 180×180 apple-touch-icon, plus the existing `favicon.ico`. (Next 16 picks these up by file convention in `app/`.)
- [ ] Verify with the Open Graph debugger and Twitter card validator after deploy

## Out of scope

- JSON-LD structured data (Iteration 2)
- Sitemap / robots (Iteration 2)
- Multilingual metadata (later iteration)

## Done when

- View-source on the homepage shows complete `<meta>` tags for OG and Twitter
- Pasting the URL into Slack/WhatsApp shows the OG image with title and description
