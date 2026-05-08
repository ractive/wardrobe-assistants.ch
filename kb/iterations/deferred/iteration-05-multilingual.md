---
title: SEO Iteration 5 — Multilingual (DE first, FR later)
type: iteration
status: deferred
order: 5
---

# Iteration 5 — Multilingual (DE first, FR later)

For a Swiss service business, DE is likely the single biggest SEO lever — most clients (theatres, festivals) operate in German. Defer until iterations 1–4 are solid in EN.

## Scope (DE phase)

- [ ] Decide URL strategy: `/de` subpath (recommended for Next.js + simpler than subdomain) vs `/de-CH`
- [ ] Configure i18n routing (Next 16 — read `node_modules/next/dist/docs/` for the current pattern; this is one of the areas the framework changed)
- [ ] Translate homepage and services page into DE
- [ ] Per-locale `metadata` (title, description, OG)
- [ ] `hreflang` tags pairing EN ↔ DE pages (`alternates.languages`)
- [ ] Update sitemap to include both locales
- [ ] DE-specific JSON-LD (LocalBusiness `inLanguage: de-CH`, Service descriptions in DE)

## Phase 2 (FR, IT) — parking lot

- Add only after DE traffic justifies the maintenance overhead
- Same pattern as DE; reuse the i18n scaffolding from this iteration

## Out of scope

- Auto-translation (use real human or carefully reviewed translation — bad German hurts more than no German for this audience)
- Right-to-left languages

## Done when

- `/` and `/de` both render with correct content + metadata
- `hreflang` validates cleanly in Search Console
- Both locales appear in the sitemap
