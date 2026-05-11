import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Combined edge-side gate for the admin app:
//
// 1. **Auth gate.** Cheap cookie-presence check that redirects unauthed
//    visitors to /login before they see a flash of dashboard chrome. The
//    full session validation still happens server-side in (dashboard)/
//    layout.tsx via auth.api.getSession(); this is purely a UX preflight.
//
// 2. **CSP with per-request nonce.** iter-16b set CSP via next.config.ts
//    headers() with `script-src 'self'` — strict but no nonce, which
//    blocks Next.js's own per-request bootstrap inline (`__next_r`) and
//    breaks the entire app. A static headers() block can't generate
//    per-request nonces; this proxy emits the CSP dynamically with a
//    fresh nonce that Next auto-stamps onto its framework + page bundles.
//
// Next.js 16 renamed `middleware.ts` → `proxy.ts`. This file lives at
// `apps/admin/src/proxy.ts`, adjacent to `app/`. Its predecessor was
// `apps/admin/middleware.ts`, removed when this file landed; having both
// in tree at once was the root cause of the post-iter-16b /login redirect
// loop (Next picked one or the other inconsistently).

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
];

// Paths that don't need an auth cookie. Negative-lookahead boundary
// `(?:$|[/?])` prevents prefix-bypass via paths like `/login-evil` or
// `/set-password-anything` slipping through unauthenticated.
// iter-31: added `api/public` so the customer-facing booking-request endpoints
// (`/api/public/services`, `/api/public/booking-requests`) are not redirected
// to /login. The boundary anchor `(?:$|[/?])` ensures `/api/publicly-evil`
// cannot slip through.
const PUBLIC_PATH_RE =
  /^\/(?:login(?:$|[/?])|set-password(?:$|[/?])|api\/auth|api\/public(?:$|[/?]))/;

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
    // iter-23: explicit worker-src allows the browser to load /sw.js as a
    // service worker. `default-src 'self'` would implicitly allow this in
    // most browsers, but the explicit directive is belt-and-suspenders and
    // documents intent clearly — the iter-23 plan (§4) calls for it.
    "worker-src 'self'",
  ];
  if (!isDev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildContentSecurityPolicy({ nonce, isDev });

  const isPublic = PUBLIC_PATH_RE.test(pathname);
  if (!isPublic) {
    const hasSession = SESSION_COOKIE_NAMES.some((name) =>
      request.cookies.has(name),
    );
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      const redirect = NextResponse.redirect(url);
      redirect.headers.set("Content-Security-Policy", csp);
      return redirect;
    }
  }

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
  // Skip static/build assets + API non-auth routes (CSP doesn't apply to
  // non-HTML responses, and prefetches don't render pages → no scripts to
  // gate). The `missing` clause skips client-router prefetches so we don't
  // spend a proxy hop generating a nonce that won't be used.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
