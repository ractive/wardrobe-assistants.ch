// iter-26: Allowlist for the public booking-request + services routes. The
// production origins are hard-coded so the set of trusted homepage origins is
// reviewable in source (no env var). Localhost is permitted only outside
// production for cross-origin dev.

const PROD_ORIGINS = [
  "https://wardrobe-assistants.ch",
  "https://www.wardrobe-assistants.ch",
];

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (PROD_ORIGINS.includes(origin)) return true;
  if (
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)
  ) {
    return true;
  }
  return false;
}

/**
 * Build the CORS response headers for an allowed origin. Returns an empty
 * Headers object when the origin is rejected — callers should branch on
 * `isAllowedOrigin` and return 403 in that case.
 */
export function corsHeaders(origin: string | null): Headers {
  const h = new Headers();
  if (!isAllowedOrigin(origin) || !origin) return h;
  h.set("Access-Control-Allow-Origin", origin);
  h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type");
  h.set("Vary", "Origin");
  return h;
}
