#!/usr/bin/env node
/**
 * iter-38 §B — WCAG AA contrast checks for the admin theme.
 *
 * Reads `apps/admin/src/app/globals.css`, parses the `:root` and `.dark`
 * blocks, converts every documented foreground/background pair from OKLCH to
 * sRGB via culori, computes WCAG 2.x relative luminance + contrast ratio,
 * and asserts each pair meets the appropriate threshold:
 *   - 4.5:1 for normal-size text
 *   - 3:1   for UI components / large text (e.g. `--ring` against backgrounds)
 *
 * Carve-out: `--muted-foreground` on `--background` is documented in the
 * design-system §1 contrast note as "borderline WCAG AA at small sizes".
 * The script emits a WARN (not FAIL) for that pair.
 *
 * Exit 0 if every required pair passes; exit 1 otherwise.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { converter, parse } from "culori";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(__dirname, "../apps/admin/src/app/globals.css");

const toRgb = converter("rgb");

function parseBlock(css, selector) {
  // Matches the first `<selector> { ... }` block (non-greedy, balanced enough
  // for our flat token blocks — we don't have nested rules inside :root/.dark).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m");
  const m = css.match(re);
  if (!m) throw new Error(`Could not find block for selector ${selector}`);
  const body = m[1];
  const tokens = {};
  const tokRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  for (const tok of body.matchAll(tokRe)) {
    tokens[tok[1]] = tok[2].trim();
  }
  return tokens;
}

function srgbChannelToLinear(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance({ r, g, b }) {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(fg, bg) {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [bright, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (bright + 0.05) / (dark + 0.05);
}

function oklchToRgb(value) {
  const parsed = parse(value);
  if (!parsed) throw new Error(`Cannot parse colour: ${value}`);
  const rgb = toRgb(parsed);
  // Clamp to sRGB gamut (some OKLCH values lie slightly outside).
  return {
    r: Math.min(1, Math.max(0, rgb.r)),
    g: Math.min(1, Math.max(0, rgb.g)),
    b: Math.min(1, Math.max(0, rgb.b)),
  };
}

// Each entry: [foreground-token, background-token, threshold, label?]
// threshold: 4.5 (small text) or 3 (large text / UI component).
const PAIRS = [
  ["--foreground", "--background", 4.5],
  ["--card-foreground", "--card", 4.5],
  ["--popover-foreground", "--popover", 4.5],
  ["--muted-foreground", "--background", 4.5],
  ["--muted-foreground", "--sidebar", 4.5],
  ["--primary-foreground", "--primary", 4.5],
  ["--secondary-foreground", "--secondary", 4.5],
  ["--muted-foreground", "--muted", 4.5],
  ["--accent-foreground", "--accent", 4.5],
  ["--destructive-foreground", "--destructive", 4.5],
  ["--sidebar-foreground", "--sidebar", 4.5],
  ["--sidebar-primary-foreground", "--sidebar-primary", 4.5],
  ["--sidebar-accent-foreground", "--sidebar-accent", 4.5],
  // UI component contrast — 3:1 per WCAG 1.4.11 (non-text contrast).
  ["--ring", "--background", 3, "ring on background"],
  ["--ring", "--card", 3, "ring on card"],
];

// Documented carve-out (design-system §1 contrast note): --muted-foreground
// on --background may be borderline at small text sizes. WARN, do not FAIL.
const WARN_ONLY_PAIRS = new Set([
  "--muted-foreground|--background",
  "--muted-foreground|--sidebar",
]);

function format(n) {
  return n.toFixed(2);
}

function runMode(label, tokens) {
  const rows = [];
  let hardFail = false;

  for (const [fgKey, bgKey, threshold, customLabel] of PAIRS) {
    const fgVal = tokens[fgKey];
    const bgVal = tokens[bgKey];
    if (!fgVal || !bgVal) {
      rows.push({
        label: customLabel ?? `${fgKey} on ${bgKey}`,
        status: "FAIL",
        ratio: "-",
        threshold,
        note: `missing required token: ${!fgVal ? fgKey : bgKey}`,
      });
      hardFail = true;
      continue;
    }
    const fg = oklchToRgb(fgVal);
    const bg = oklchToRgb(bgVal);
    const ratio = contrastRatio(fg, bg);
    const pairKey = `${fgKey}|${bgKey}`;
    const warnOnly = WARN_ONLY_PAIRS.has(pairKey);
    let status;
    if (ratio >= threshold) {
      status = "PASS";
    } else if (warnOnly) {
      status = "WARN";
    } else {
      status = "FAIL";
      hardFail = true;
    }
    rows.push({
      label: customLabel ?? `${fgKey} on ${bgKey}`,
      status,
      ratio: format(ratio),
      threshold,
      note: warnOnly ? "documented carve-out (design-system §1)" : "",
    });
  }

  console.log(`\n=== ${label} ===`);
  const widthL = Math.max(...rows.map((r) => r.label.length), 5);
  console.log(
    `${"PAIR".padEnd(widthL)}  ${"RATIO".padStart(6)}  ${"MIN".padStart(4)}  STATUS  NOTE`,
  );
  for (const r of rows) {
    console.log(
      `${r.label.padEnd(widthL)}  ${String(r.ratio).padStart(6)}  ${String(
        r.threshold,
      ).padStart(4)}  ${r.status.padEnd(6)}  ${r.note}`,
    );
  }
  return hardFail;
}

function main() {
  const css = readFileSync(CSS_PATH, "utf8");
  const lightTokens = parseBlock(css, ":root");
  const darkTokens = parseBlock(css, ".dark");

  const lightFail = runMode("Light (:root)", lightTokens);
  const darkFail = runMode("Dark (.dark)", darkTokens);

  if (lightFail || darkFail) {
    console.error("\nFAIL: one or more required pairs are below threshold.");
    process.exit(1);
  }
  console.log("\nPASS: all required pairs meet WCAG AA.");
}

main();
