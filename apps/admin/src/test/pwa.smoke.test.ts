// @vitest-environment node
//
// Smoke tests for PWA-related routes and headers (iter-23).
// Verifies: /sw.js headers, /manifest.webmanifest headers, and that the
// CSP emitted by proxy.ts includes `worker-src 'self'`.
//
// No Next.js runtime — reads next.config and proxy directly.
import { describe, expect, it } from "vitest";

describe("Service Worker headers", () => {
  it("next.config headers() includes /sw.js source with required headers", async () => {
    const cfg = await import("../../next.config");
    const headers = await cfg.default.headers?.();
    if (!headers) throw new Error("next.config headers() not configured");

    const swRule = headers.find((h) => h.source === "/sw.js");
    expect(swRule, "no /sw.js rule in next.config headers()").toBeDefined();

    const swHeaders = Object.fromEntries(
      (swRule?.headers ?? []).map((h) => [h.key, h.value]),
    );

    expect(swHeaders["Content-Type"]).toMatch(/application\/javascript/);
    expect(swHeaders["Cache-Control"]).toMatch(/no-store/);
    expect(swHeaders["Service-Worker-Allowed"]).toBe("/");
  });
});

describe("Manifest headers", () => {
  it("next.config headers() includes security headers that apply to /manifest.webmanifest", async () => {
    const cfg = await import("../../next.config");
    const headers = await cfg.default.headers?.();
    if (!headers) throw new Error("next.config headers() not configured");

    // The /(.*) catch-all applies to manifest.webmanifest.
    const catchAll = headers.find(
      (h) => h.source === "/(.*)" || h.source === "/((?!_next).*)",
    );
    expect(catchAll, "no catch-all rule in headers()").toBeDefined();
  });
});

describe("CSP worker-src", () => {
  it("proxy buildContentSecurityPolicy includes worker-src 'self'", async () => {
    const proxy = await import("../proxy");
    const csp = proxy.buildContentSecurityPolicy({
      nonce: "test",
      isDev: false,
    });
    expect(csp).toContain("worker-src 'self'");
  });

  it("proxy buildContentSecurityPolicy still includes required base directives", async () => {
    const proxy = await import("../proxy");
    const csp = proxy.buildContentSecurityPolicy({
      nonce: "test",
      isDev: false,
    });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("'nonce-test'");
  });
});
