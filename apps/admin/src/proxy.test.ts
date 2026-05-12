// @vitest-environment node
// This test exercises the pure-Node proxy (NextRequest cookie parsing,
// header inspection, CSP shape) — no DOM is needed, and happy-dom 20
// mutates the global Headers/cookie behaviour in ways that break
// NextRequest here.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, proxy, validateReturnTo } from "./proxy";

function makeRequest(
  url: string,
  cookies: Record<string, string> = {},
): NextRequest {
  const headers = new Headers();
  if (Object.keys(cookies).length > 0) {
    headers.set(
      "cookie",
      Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );
  }
  return new NextRequest(new URL(url), { headers });
}

describe("proxy — auth gate", () => {
  it("redirects unauthenticated requests on protected paths to /login", () => {
    const res = proxy(makeRequest("https://admin.example.com/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login(\?|$)/u);
  });

  it("passes through when a session cookie is present", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/", {
        "better-auth.session_token": "stub",
      }),
    );
    // NextResponse.next() carries no Location header.
    expect(res.headers.get("location")).toBeNull();
  });

  it("recognizes the __Secure-* cookie variant", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/", {
        "__Secure-better-auth.session_token": "stub",
      }),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /login itself when unauthenticated", () => {
    const res = proxy(makeRequest("https://admin.example.com/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /set-password when unauthenticated (invite flow)", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/set-password?token=abc"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /api/auth/* (Better Auth endpoints)", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/api/auth/sign-in/email"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /api/public/services (public catalog endpoint)", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/api/public/services"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /api/public/booking-requests (public submission endpoint)", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/api/public/booking-requests"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /api/public root (exact match)", () => {
    const res = proxy(makeRequest("https://admin.example.com/api/public"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /api/public/ (trailing slash)", () => {
    const res = proxy(makeRequest("https://admin.example.com/api/public/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("rejects /api/publicly-evil prefix-bypass attempts", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/api/publicly-evil"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login(\?|$)/u);
  });

  it("rejects /login-evil prefix-bypass attempts", () => {
    const res = proxy(makeRequest("https://admin.example.com/login-evil"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login(\?|$)/u);
  });

  it("appends returnTo with the original path on redirect to /login", () => {
    const res = proxy(makeRequest("https://admin.example.com/bookings/123"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("returnTo=");
    // The encoded path must include the original page, not just /login.
    const url = new URL(location, "https://admin.example.com");
    const returnTo = decodeURIComponent(url.searchParams.get("returnTo") ?? "");
    expect(returnTo).toBe("/bookings/123");
  });
});

describe("proxy — validateReturnTo", () => {
  it("accepts a simple absolute path", () => {
    expect(validateReturnTo("/legit/path")).toBe("/legit/path");
  });

  it("accepts the root path /", () => {
    expect(validateReturnTo("/")).toBe("/");
  });

  it("rejects a protocol-relative URL (//evil.com/)", () => {
    expect(validateReturnTo("//evil.com/")).toBe("/");
  });

  it("rejects an https:// absolute URL", () => {
    expect(validateReturnTo("https://evil.com/")).toBe("/");
  });

  it("rejects javascript: scheme", () => {
    expect(validateReturnTo("javascript:alert(1)")).toBe("/");
  });

  it("returns / for null", () => {
    expect(validateReturnTo(null)).toBe("/");
  });

  it("returns / for undefined", () => {
    expect(validateReturnTo(undefined)).toBe("/");
  });

  it("returns / for empty string", () => {
    expect(validateReturnTo("")).toBe("/");
  });

  it("rejects backslash-prefixed paths (browsers normalize \\ → /)", () => {
    expect(validateReturnTo("/\\/evil.com")).toBe("/");
    expect(validateReturnTo("\\\\evil.com")).toBe("/");
  });

  it("rejects URL-encoded slash variants", () => {
    expect(validateReturnTo("/%2f%2fevil.com")).toBe("/");
    expect(validateReturnTo("/%2F/evil.com")).toBe("/");
    expect(validateReturnTo("/%5c%5cevil.com")).toBe("/");
  });

  it("rejects mixed-case dangerous schemes", () => {
    expect(validateReturnTo("jAvAsCrIpT:alert(1)")).toBe("/");
    expect(validateReturnTo("HTTPS://evil.com")).toBe("/");
    expect(validateReturnTo("data:text/html,<script>alert(1)</script>")).toBe(
      "/",
    );
    expect(validateReturnTo("vbscript:msgbox(1)")).toBe("/");
    expect(validateReturnTo("file:///etc/passwd")).toBe("/");
  });

  it("rejects whitespace/control characters that bypass startsWith checks", () => {
    expect(validateReturnTo(" //evil.com")).toBe("/");
    expect(validateReturnTo("/\tevil.com")).toBe("/");
    expect(validateReturnTo("/\nevil.com")).toBe("/");
    expect(validateReturnTo("/\r//evil.com")).toBe("/");
  });
});

describe("proxy — CSP", () => {
  it("attaches Content-Security-Policy with a nonce on every response", () => {
    const res = proxy(
      makeRequest("https://admin.example.com/", {
        "better-auth.session_token": "stub",
      }),
    );
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src [^;]*'nonce-[^']+'/u);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("attaches Content-Security-Policy on auth-redirect responses too", () => {
    const res = proxy(makeRequest("https://admin.example.com/users"));
    expect(res.status).toBe(307);
    expect(res.headers.get("Content-Security-Policy")).toMatch(
      /script-src [^;]*'nonce-[^']+'/u,
    );
  });

  it("buildContentSecurityPolicy includes 'unsafe-eval' in dev only", () => {
    const dev = buildContentSecurityPolicy({ nonce: "abc", isDev: true });
    const prod = buildContentSecurityPolicy({ nonce: "abc", isDev: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("upgrade-insecure-requests");
  });
});
