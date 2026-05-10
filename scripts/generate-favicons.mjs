#!/usr/bin/env node

// Regenerates a Next.js app's favicon set from the Lucide "shirt" icon path.
// Outputs Next.js 16 app-icon-convention files (app/favicon.ico, app/icon.svg,
// app/apple-icon.png) and optionally PWA + Web Push assets under public/.
//
// Usage:
//   node scripts/generate-favicons.mjs <app-dir> [--pwa]
//   node scripts/generate-favicons.mjs apps/admin --pwa
//   node scripts/generate-favicons.mjs apps/homepage
//
// Re-run when the brand color or icon shape changes. Idempotent.
//
// Reference: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md
//            https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");

const args = process.argv.slice(2);
const appDirArg = args.find((a) => !a.startsWith("--"));
const pwa = args.includes("--pwa");

if (!appDirArg) {
  console.error("Usage: node scripts/generate-favicons.mjs <app-dir> [--pwa]");
  process.exit(2);
}

const APP_ROOT = path.resolve(REPO_ROOT, appDirArg);
const APP_DIR = path.join(APP_ROOT, "src/app");
const PUBLIC_DIR = path.join(APP_ROOT, "public");

// Fail fast on a typo'd path — writing into a non-existent app dir would
// otherwise produce a less-obvious error several lines later.
try {
  const stat = await fs.stat(APP_ROOT);
  if (!stat.isDirectory()) throw new Error("not a directory");
} catch {
  console.error(
    `Error: app directory not found or not a directory: ${appDirArg}`,
  );
  process.exit(2);
}

// Lucide shirt — viewBox 0 0 24 24, stroke 2, round caps/joins.
// Source: node_modules/lucide-react/dist/esm/icons/shirt.mjs
const SHIRT_PATH =
  "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z";

// Brand colors (iter-16i bordeaux override).
const BRAND = "#7d2b3b";
const BRAND_DARK = "#5a1f2a";
const BRAND_LIGHT = "#9a3a4d";

// Master SVG for the branded square icon (rounded corners, gradient bg, white shirt).
function brandedSVG({ rounded = true }) {
  // Logical canvas: 64. Shirt scale tuned so the silhouette reads at 16px.
  const C = 64;
  const radius = rounded ? Math.round(C * 0.22) : 0;
  const shirtScale = 0.62;
  const shirtSize = C * shirtScale;
  const shirtTranslate = (C - shirtSize) / 2;
  const stroke = 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${C} ${C}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRAND_LIGHT}"/>
      <stop offset="1" stop-color="${BRAND_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="${C}" height="${C}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>
  <g transform="translate(${shirtTranslate} ${shirtTranslate}) scale(${shirtSize / 24})" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${SHIRT_PATH}"/>
  </g>
</svg>`;
}

// Maskable: full-bleed bordeaux, shirt shrunk inside the 80% safe zone.
// Per https://web.dev/articles/maskable-icon — content must stay within
// a circle of diameter 80% of the canvas edge.
function maskableSVG() {
  const C = 64;
  const shirtScale = 0.46;
  const shirtSize = C * shirtScale;
  const shirtTranslate = (C - shirtSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${C} ${C}">
  <rect width="${C}" height="${C}" fill="${BRAND}"/>
  <g transform="translate(${shirtTranslate} ${shirtTranslate}) scale(${shirtSize / 24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${SHIRT_PATH}"/>
  </g>
</svg>`;
}

// Web Push notification badge — Android requires monochrome alpha-only.
// White glyph on transparent; the OS tints it.
function badgeSVG() {
  const C = 64;
  const shirtScale = 0.78;
  const shirtSize = C * shirtScale;
  const shirtTranslate = (C - shirtSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${C} ${C}">
  <g transform="translate(${shirtTranslate} ${shirtTranslate}) scale(${shirtSize / 24})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${SHIRT_PATH}"/>
  </g>
</svg>`;
}

// SVG viewBox is 64 units; sharp's default rasterization DPI is 72.
// To render the SVG at exactly N px sharp wants `density = 72 * N / 64`.
// We render at 1.5× the target size before downscaling so anti-aliasing
// has headroom — gives crisper edges than rasterizing at exactly the
// target size (especially for the 512px outputs the previous fixed
// density: 384 was upscaling and softening).
const SVG_VIEWBOX = 64;
function densityFor(size) {
  return Math.max(72, Math.ceil((72 * size * 1.5) / SVG_VIEWBOX));
}

async function rasterize(svg, size) {
  return sharp(Buffer.from(svg), { density: densityFor(size) })
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Build a multi-image ICO from raw PNG buffers.
// ICO format: ICONDIR (6 bytes) + N × ICONDIRENTRY (16 bytes) + concatenated PNGs.
// PNG-in-ICO is supported by every modern browser; the BMP fallback isn't worth the bytes.
function buildIco(pngs, sizes) {
  const num = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(num, 4);

  let offset = 6 + num * 16;
  const entries = [];
  for (let i = 0; i < num; i++) {
    const png = pngs[i];
    const sz = sizes[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(sz >= 256 ? 0 : sz, 0);
    e.writeUInt8(sz >= 256 ? 0 : sz, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

async function main() {
  await fs.mkdir(APP_DIR, { recursive: true });
  if (pwa) await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const branded = brandedSVG({ rounded: true });
  const masterSquare = brandedSVG({ rounded: false });

  // 1. app/icon.svg — modern browsers (Chrome/Firefox/Safari prefer this).
  await fs.writeFile(path.join(APP_DIR, "icon.svg"), branded);

  // 2. app/favicon.ico — legacy fallback. 16/32/48 covers Win taskbar + IE + Safari pinning.
  const ico16 = await rasterize(branded, 16);
  const ico32 = await rasterize(branded, 32);
  const ico48 = await rasterize(branded, 48);
  await fs.writeFile(
    path.join(APP_DIR, "favicon.ico"),
    buildIco([ico16, ico32, ico48], [16, 32, 48]),
  );

  // 3. app/apple-icon.png — iOS Safari & home-screen install. 180×180, no transparency.
  await sharp(Buffer.from(brandedSVG({ rounded: false })), {
    density: densityFor(180),
  })
    .resize(180, 180)
    .flatten({ background: BRAND })
    .png({ compressionLevel: 9 })
    .toFile(path.join(APP_DIR, "apple-icon.png"));

  console.log(`Wrote head-icon set to ${path.relative(REPO_ROOT, APP_DIR)}/`);
  console.log("  favicon.ico, icon.svg, apple-icon.png");

  if (!pwa) return;

  // 4. public/icon-192.png + icon-512.png — PWA manifest standard sizes.
  await fs.writeFile(
    path.join(PUBLIC_DIR, "icon-192.png"),
    await rasterize(masterSquare, 192),
  );
  await fs.writeFile(
    path.join(PUBLIC_DIR, "icon-512.png"),
    await rasterize(masterSquare, 512),
  );

  // 5. public/icon-maskable-512.png — Android adaptive icons.
  await fs.writeFile(
    path.join(PUBLIC_DIR, "icon-maskable-512.png"),
    await rasterize(maskableSVG(), 512),
  );

  // 6. public/badge-72.png — Android Web Push notification badge (monochrome).
  await fs.writeFile(
    path.join(PUBLIC_DIR, "badge-72.png"),
    await rasterize(badgeSVG(), 72),
  );

  console.log(
    `Wrote PWA + Web Push assets to ${path.relative(REPO_ROOT, PUBLIC_DIR)}/`,
  );
  console.log(
    "  icon-192.png, icon-512.png, icon-maskable-512.png, badge-72.png",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
