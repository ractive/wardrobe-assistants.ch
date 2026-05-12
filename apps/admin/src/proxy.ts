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
// iter-39 §A.4: PWA manifest (`/manifest.webmanifest`, emitted by
// `app/manifest.ts`) must be reachable without a session cookie. Without
// this entry the proxy 302s the request to `/login`, the browser parses
// the redirect's HTML as JSON, and DevTools logs
// `Manifest: Line: 1, column: 1, Syntax`. The manifest's referenced
// icons (`/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png`,
// `/badge-72.png` — see `app/manifest.ts` + `public/`) live at the root
// and are caught by this proxy's matcher; they also need to be public
// or the browser can't fully install the PWA (Copilot, iter-39 review).
// All entries here are leaf resources — `(?:$|\?)` keeps subpaths like
// `/manifest.webmanifest/anything` out of the allow-list (CodeRabbit,
// iter-39 review).
const PUBLIC_PATH_RE =
  /^\/(?:login(?:$|[/?])|set-password(?:$|[/?])|api\/auth(?:$|[/?])|api\/public(?:$|[/?])|manifest\.webmanifest(?:$|\?)|icon-192\.png(?:$|\?)|icon-512\.png(?:$|\?)|icon-maskable-512\.png(?:$|\?)|badge-72\.png(?:$|\?))/;

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

/**
 * Validate that a `returnTo` value is safe for same-origin redirect.
 *
 * Accepts only paths that:
 *   - Start with a single `/`
 *   - Do not contain `://` (absolute URL) or `//` (protocol-relative URL)
 *   - Do not start with `javascript:`
 *
 * Returns the path as-is when valid, or `"/"` as a safe fallback.
 * Exported for unit testing.
 */
export function validateReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  // Reject backslashes outright — some browsers normalize `\` to `/`, which
  // would turn `/\\evil.com` into `//evil.com` after redirect.
  if (value.includes("\\")) return "/";
  // Reject any control or whitespace characters (CR/LF/TAB/space/etc.) — they
  // can sneak past `startsWith("/")` checks and confuse downstream URL parsers.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately rejects control chars from user-supplied returnTo
  if (/[\s\u0000-\u001f\u007f]/u.test(value)) return "/";
  // Reject URL-encoded slashes that would re-introduce a protocol-relative
  // prefix once Next.js decodes the path.
  if (/%2f|%5c/iu.test(value)) return "/";
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://") ||
    /^\/(?:javascript|data|vbscript|file):/iu.test(value) ||
    /^(?:javascript|data|vbscript|file):/iu.test(value)
  ) {
    return "/";
  }
  return value;
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
      // Preserve the original path so the login page can redirect back after
      // successful authentication (D.3). Only the path + search are
      // forwarded — never the full URL — to avoid an open-redirect.
      // (The hash is not visible to the server, so it isn't forwarded.)
      url.search = `?returnTo=${encodeURIComponent(pathname + request.nextUrl.search)}`;
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
