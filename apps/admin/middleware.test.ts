import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "./middleware";

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

describe("middleware", () => {
  it("redirects unauthenticated requests to /login", () => {
    const res = middleware(makeRequest("https://admin.example.com/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login$/u);
  });

  it("passes through when a session cookie is present", () => {
    const res = middleware(
      makeRequest("https://admin.example.com/", {
        "better-auth.session_token": "stub",
      }),
    );
    // NextResponse.next() carries no Location header.
    expect(res.headers.get("location")).toBeNull();
  });

  it("recognizes the __Secure-* cookie variant", () => {
    const res = middleware(
      makeRequest("https://admin.example.com/", {
        "__Secure-better-auth.session_token": "stub",
      }),
    );
    expect(res.headers.get("location")).toBeNull();
  });
});
