---
title: SEO Iteration 3 — Asset hygiene
type: iteration
status: planned
order: 3
---

# Iteration 3 — Asset hygiene

Page weight is a ranking signal and currently 3.3MB of unused images ship to the CDN. Clean up before the deep content page lands.

## Findings

- `public/background.png` (1.9MB) — referenced **only** by `wardrobe-assistants.pen`, not by the website. The site uses `background.webp` (64KB).
- `public/steam.jpg` (1.4MB) — referenced once in the .pen file, but **only on a disabled frame** (`Hero Right`, id `5cVc5`, `enabled: false`). Not rendered anywhere, by design or in code.
- `public/steam Kopie.jpg` (104KB) — leftover backup, untracked, not referenced anywhere.
- The Dockerfile copies all of `public/` into the production container, so these ship even though no page loads them.

## Scope

- [ ] Delete the disabled `Hero Right` frame (`5cVc5`) from the .pen file (it's no longer in the design — the code uses a full-page background instead)
- [ ] Delete `public/steam.jpg` (no remaining references after the frame is removed)
- [ ] Delete `public/steam Kopie.jpg`
- [ ] For `background.png` (still used in the .pen as the document-level background fill): create `design-assets/` at the repo root, move `background.png` there, and update the .pen reference from `public/background.png` to `../design-assets/background.png`
- [ ] Verify Pencil still renders the design correctly after the path change
- [ ] Confirm the only public images shipped are `background.webp`, `og-image.*`, favicons, and any future `next/image` sources
- [ ] (Optional) Convert any remaining JPG/PNG content images to WebP/AVIF and migrate to `next/image`

## Out of scope

- New imagery for the services page (handled in Iteration 4 if needed)

## Done when

- `du -sh public/` is well under 200KB
- `.pen` file still opens cleanly in Pencil with all images visible
- Production build size shrinks correspondingly
