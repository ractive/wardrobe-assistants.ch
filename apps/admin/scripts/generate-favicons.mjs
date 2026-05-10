#!/usr/bin/env node

// Regenerates the admin favicon set from the Lucide "shirt" icon path.
// Outputs Next.js app-icon-convention files (app/favicon.ico, app/icon.svg,
// app/apple-icon.png) plus PWA + Web Push assets under public/.
//
// Re-run with `node scripts/generate-favicons.mjs` from apps/admin/
// when the brand color or icon shape changes.
//
// Reference: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md
//            https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const ADMIN_DIR = path.resolve(path.dirname(__filename), "..");
const APP_DIR = path.join(ADMIN_DIR, "src/app");
const PUBLIC_DIR = path.join(ADMIN_DIR, "public");

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
  // Lucide stroke-width 2 at native 24-unit canvas → effective 2/24 of the
  // shirt's painted size. Crank stroke at small sizes to keep the glyph
  // legible after rasterization.
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
  const shirtScale = 0.46; // safely inside the 80% safe-zone circle
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

async function rasterize(svg, size) {
  return sharp(Buffer.from(svg), { density: 384 })
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
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(num, 4);

  let offset = 6 + num * 16;
  const entries = [];
  for (let i = 0; i < num; i++) {
    const png = pngs[i];
    const sz = sizes[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(sz >= 256 ? 0 : sz, 0); // width (0 = 256)
    e.writeUInt8(sz >= 256 ? 0 : sz, 1); // height
    e.writeUInt8(0, 2); // color count (0 = ≥256)
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(png.length, 8); // size in bytes
    e.writeUInt32LE(offset, 12); // offset
    entries.push(e);
    offset += png.length;
  }
  return Buffer.concat([header, ...entries, ...pngs]);
}

async function main() {
  await fs.mkdir(APP_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  const branded = brandedSVG({ rounded: true });
  const masterSquare = brandedSVG({ rounded: false }); // PWA icons render full-bleed
  const maskable = maskableSVG();
  const badge = badgeSVG();

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
  // Per Apple HIG, fill the canvas — iOS doesn't apply rounding anymore but draws on white.
  await sharp(Buffer.from(brandedSVG({ rounded: false })), { density: 384 })
    .resize(180, 180)
    .flatten({ background: BRAND })
    .png({ compressionLevel: 9 })
    .toFile(path.join(APP_DIR, "apple-icon.png"));

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
    await rasterize(maskable, 512),
  );

  // 6. public/badge-72.png — Android Web Push notification badge (monochrome).
  await fs.writeFile(
    path.join(PUBLIC_DIR, "badge-72.png"),
    await rasterize(badge, 72),
  );

  console.log("Generated:");
  console.log("  app/icon.svg               — modern browsers (sizes=any)");
  console.log("  app/favicon.ico            — legacy 16/32/48");
  console.log("  app/apple-icon.png         — iOS 180×180");
  console.log("  public/icon-192.png        — PWA manifest");
  console.log("  public/icon-512.png        — PWA manifest");
  console.log("  public/icon-maskable-512.png — PWA Android adaptive");
  console.log("  public/badge-72.png        — Web Push badge");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
