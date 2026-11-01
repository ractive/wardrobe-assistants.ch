// Runs the smoke script in its offline mode (HOMEPAGE_HTML_FILE) against
// minimal pages shaped like the static export's inline RSC payload, where
// every quote inside the `self.__next_f.push` string literal is escaped.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("./homepage-catalog-non-empty.sh", import.meta.url),
);
const dir = mkdtempSync(join(tmpdir(), "catalog-smoke-"));

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Nav elements carry `id` props too — they must not count as catalog entries.
const nav = String.raw`[\"$\",\"input\",null,{\"id\":\"nav-toggle\",\"type\":\"checkbox\"}]`;

function page(servicesJson: string): string {
  return `<html><body><script>self.__next_f.push([1,"${nav}\\n[\\"$\\",\\"$L21\\",null,{\\"services\\":${servicesJson},\\"submitUrl\\":\\"https://admin.example.com/api/public/booking-requests\\"}]"])</script></body></html>`;
}

function run(html: string) {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(file, html);
  const res = spawnSync("bash", [script], {
    env: { ...process.env, HOMEPAGE_HTML_FILE: file },
    encoding: "utf8",
  });
  return { status: res.status, stdout: res.stdout };
}

describe("homepage-catalog-non-empty.sh", () => {
  it("passes for a non-empty catalog in the escaped RSC payload", () => {
    const entry = (id: string) =>
      String.raw`{\"id\":\"${id}\",\"name\":\"Steaming\",\"description\":null,\"priceType\":\"hourly\",\"price\":80}`;
    const { status, stdout } = run(page(`[${entry("a")},${entry("b")}]`));
    expect(stdout).toContain("PASS");
    expect(stdout).toContain("(2 entries)");
    expect(status).toBe(0);
  });

  it("passes for an unescaped payload", () => {
    const { status } = run(
      `<script>{"services":[{"id":"a","priceType":"fixed"}]}</script>`,
    );
    expect(status).toBe(0);
  });

  it("does not depend on the key order of catalog entries", () => {
    const { status } = run(
      page(
        String.raw`[{\"name\":\"Steaming\",\"id\":\"a\",\"priceType\":\"fixed\"}]`,
      ),
    );
    expect(status).toBe(0);
  });

  it("fails for an empty catalog even though nav ids are present", () => {
    const { status, stdout } = run(page("[]"));
    expect(stdout).toContain("services catalog is empty");
    expect(status).toBe(1);
  });

  it("fails when the services prop is missing", () => {
    const { status, stdout } = run("<html><body>maintenance</body></html>");
    expect(stdout).toContain("no services prop");
    expect(status).toBe(1);
  });
});
