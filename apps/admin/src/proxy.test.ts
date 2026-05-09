// @vitest-environment node
// This test exercises the pure-Node proxy (NextRequest cookie parsing,
// header inspection, CSP shape) — no DOM is needed, and happy-dom 20
// mutates the global Headers/cookie behaviour in ways that break
// NextRequest here.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, proxy } from "./proxy";

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
    expect(res.headers.get("location")).toMatch(/\/login$/u);
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

  it("rejects /login-evil prefix-bypass attempts", () => {
    const res = proxy(makeRequest("https://admin.example.com/login-evil"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/u);
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
