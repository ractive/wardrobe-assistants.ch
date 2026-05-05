---
title: Cross-browser performance notes
type: tool-report
status: ongoing
---

# Cross-browser performance notes

Lighthouse measures Chromium; `ff-rdp perf` measures Firefox. Each row is a measurement pair captured from the same URL within a few minutes, so divergence reflects engine differences rather than network drift.

## How to use this document

1. Run `npm run lighthouse:homepage` and `npm run lighthouse:services` (Chromium).
2. Run `ff-rdp perf audit` against each URL (Firefox) — see [Performance auditing](../../README.md#performance-auditing).
3. Append a row below with both numbers and a short note for any metric that diverges by **>20%** between engines.

The committed file lives here; the JSON/HTML reports themselves are gitignored.

## Log

| Date       | Page        | Metric | Chrome (Lighthouse) | Firefox (ff-rdp) | Notes |
| ---------- | ----------- | ------ | ------------------- | ---------------- | ----- |
| 2026-05-05 | /           | LCP    | _pending_           | _pending_        | Iter-10 baseline run pending — preload + display=swap landed but cross-browser numbers not yet collected |
| 2026-05-05 | /services/  | LCP    | _pending_           | _pending_        | Same — backfill once both audits run live post-merge |

No significant divergence recorded yet.
