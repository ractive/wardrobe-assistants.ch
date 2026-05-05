#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PAGES = {
  homepage: { path: "/", slug: "homepage" },
  services: { path: "/services/", slug: "services" },
};

const target = process.argv[2];
const page = PAGES[target];
if (!page) {
  console.error(
    `Usage: node scripts/lighthouse.mjs <${Object.keys(PAGES).join("|")}>`,
  );
  process.exit(2);
}

const liveOrigin = "https://wardrobe-assistants.ch";
const localOrigin = "http://localhost:4173";
const useLocal = process.env.LH_TARGET === "local";
const url = `${useLocal ? localOrigin : liveOrigin}${page.path}`;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reportsDir = join(repoRoot, "kb", "perf-reports");
mkdirSync(reportsDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const base = join(reportsDir, `${page.slug}-${stamp}`);

const args = [
  url,
  "--preset=desktop",
  "--output=json",
  "--output=html",
  `--output-path=${base}`,
  "--chrome-flags=--headless=new --no-sandbox",
  "--quiet",
];

console.log(`Running Lighthouse against ${url}`);
console.log(`Reports: ${base}.report.{json,html}`);

const child = spawn("npx", ["--no-install", "lighthouse", ...args], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 1));
