import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import {
  clientIpFromHeaders,
  consume,
  RATE_LIMITS,
  type RateLimitResult,
  retryAfterSeconds,
} from "@/lib/rate-limit";

const baseHandler = toNextJsHandler(auth.handler);

// iter-16f / audit C-SEC-02: rate-limit the auth-sensitive POST endpoints
// before they reach Better Auth. Better Auth ships its own RL plugin, but
// it stores counters in the auth DB — this in-memory layer protects the
// single-container deploy without the per-request DB write tax. The
// rules:
//   - login          5/15min  per IP + email (credential stuffing)
//   - password reset 3/hour   per email      (transactional email cost)
//   - signup         3/hour   per IP         (defense in depth — signup
//                                             is invite-gated upstream)
// Sign-out / get-session / list-passkeys / etc. are read or trivially
// idempotent and don't need a floor here.
//
// Path layout matches Better Auth's catch-all routing: `/api/auth/<path>`
// where `<path>` is e.g. `sign-in/email`, `request-password-reset`,
// `sign-up/email`. We match on suffix so plugin-mounted variants
// (e.g., 2FA-augmented sign-in) are still covered.
type LimiterKey = "login" | "passwordReset" | "signup";

interface LimiterMatch {
  bucket: LimiterKey;
  identifierFromBody: (body: unknown) => string | null;
}

function pickLimiter(pathname: string): LimiterMatch | null {
  if (
    pathname.endsWith("/sign-in/email") ||
    pathname.endsWith("/sign-in/email-password")
  ) {
    return { bucket: "login", identifierFromBody: extractEmail };
  }
  if (
    pathname.endsWith("/request-password-reset") ||
    pathname.endsWith("/forget-password")
  ) {
    return { bucket: "passwordReset", identifierFromBody: extractEmail };
  }
  if (pathname.endsWith("/sign-up/email")) {
    return { bucket: "signup", identifierFromBody: () => null };
  }
  return null;
}

function extractEmail(body: unknown): string | null {
  if (
    body !== null &&
    typeof body === "object" &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string"
  ) {
    return (body as { email: string }).email.toLowerCase().trim();
  }
  return null;
}

async function readJsonBody(req: Request): Promise<unknown> {
  // The downstream Better Auth handler reads the body again, so we
  // re-clone the request before parsing — body streams are
  // single-shot. `req.clone()` would also work but is heavier than
  // tee-ing a Buffer.
  try {
    return await req.clone().json();
  } catch {
    return null;
  }
}

function tooManyRequests(result: RateLimitResult): Response {
  const retryAfter = retryAfterSeconds(result);
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Too many requests. Please try again later.",
    }),
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Content-Type": "application/json",
      },
    },
  );
}

export const GET = baseHandler.GET;

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = pickLimiter(url.pathname);
  if (match) {
    const ip = clientIpFromHeaders(req.headers);
    const body = await readJsonBody(req);
    const identifier = match.identifierFromBody(body) ?? "";
    // Combine IP + identifier for login/reset (IP alone for signup).
    const key = `${match.bucket}:${ip}:${identifier}`;
    const result = consume(key, RATE_LIMITS[match.bucket]);
    if (!result.allowed) {
      return tooManyRequests(result);
    }
  }
  return baseHandler.POST(req);
}
