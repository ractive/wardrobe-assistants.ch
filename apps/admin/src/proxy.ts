import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Per-request CSP with a fresh nonce. Next.js 16 renamed `middleware.ts` →
// `proxy.ts`; placement at `apps/admin/src/proxy.ts` keeps it adjacent to
// `app/`. iter-16b set CSP via `next.config.ts` headers(), but `script-src
// 'self'` blocks Next.js's own per-request bootstrap inline (`__next_r`).
// The structurally correct fix is a nonce: this proxy generates one per
// request, sets it on the CSP header AND on the `x-nonce` request header
// so RSCs / Next's renderer can stamp the same nonce onto the framework
// scripts. The CSP from next.config.ts has been removed for that reason —
// keep the directive list here as the single source of truth.
//
// Dev quirks:
//  - React Refresh uses `eval` to reconstruct stack traces → 'unsafe-eval'.
//  - Turbopack injects inline styles for HMR → keep style-src 'unsafe-inline'
//    in dev. In prod the framework only ships hashed/external stylesheets,
//    but Tailwind v4's runtime-injected styles still need 'unsafe-inline'
//    for now (iter-16b decision; tighten when Tailwind moves to nonce'd
//    style injection).

export type CspOptions = {
  nonce: string;
  isDev: boolean;
};

/**
 * Build the Content-Security-Policy header value. Exported for tests so the
 * smoke harness can assert directive shape without spinning up a real proxy
 * runtime. The dev/prod branch is identical to what `proxy()` emits live.
 */
export function buildContentSecurityPolicy({
  nonce,
  isDev,
}: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildContentSecurityPolicy({ nonce, isDev });

  // The nonce travels two ways: as the standard CSP header (so the browser
  // enforces it) and as `x-nonce` on the request (so server components can
  // read it via `headers().get('x-nonce')` if they need to stamp custom
  // <Script> tags). Next.js itself parses 'nonce-...' out of the CSP header
  // and applies the value to its framework + page bundles automatically.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip static/build assets + API routes (CSP doesn't apply to non-HTML
  // responses anyway, and prefetches don't render pages → no scripts to
  // gate). The `missing` clause skips client-router prefetches so we don't
  // spend a proxy hop generating a nonce that won't be used.
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
