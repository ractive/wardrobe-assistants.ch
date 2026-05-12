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

// Per-bucket key strategy:
//   - login         → IP + email (credential stuffing across both)
//   - passwordReset → email only (don't let an attacker rotate IPs to
//                     spam reset emails to the same address)
//   - signup        → IP only (no identifier yet; bound the abuser)
type KeyStrategy = "ipAndEmail" | "emailOnly" | "ipOnly";

interface LimiterMatch {
  bucket: LimiterKey;
  strategy: KeyStrategy;
  identifierFromBody: (body: unknown) => string | null;
}

function pickLimiter(pathname: string): LimiterMatch | null {
  if (
    pathname.endsWith("/sign-in/email") ||
    pathname.endsWith("/sign-in/email-password")
  ) {
    return {
      bucket: "login",
      strategy: "ipAndEmail",
      identifierFromBody: extractEmail,
    };
  }
  if (
    pathname.endsWith("/request-password-reset") ||
    pathname.endsWith("/forget-password")
  ) {
    return {
      bucket: "passwordReset",
      strategy: "emailOnly",
      identifierFromBody: extractEmail,
    };
  }
  if (pathname.endsWith("/sign-up/email")) {
    return {
      bucket: "signup",
      strategy: "ipOnly",
      identifierFromBody: () => null,
    };
  }
  return null;
}

function buildLimiterKey(
  match: LimiterMatch,
  ip: string,
  identifier: string,
): string {
  switch (match.strategy) {
    case "ipAndEmail":
      return `${match.bucket}:${ip}:${identifier}`;
    case "emailOnly":
      return `${match.bucket}:${identifier}`;
    case "ipOnly":
      return `${match.bucket}:${ip}`;
  }
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
  // clone the request before parsing — body streams are single-shot.
  // `req.clone()` is the simplest correct path here; a manual
  // tee-into-Buffer would be slightly cheaper but not worth the
  // complexity at this traffic level.
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

// Defense-in-depth pair with `infra/terraform/pullzones.tf` (`strip_cookies =
// false`): force the strongest no-cache shape on every auth response so the
// bunny CDN cannot cache a Set-Cookie / session-bearing body. Better Auth's
// default `Cache-Control: no-cache` is too weak — bunny treats it as
// "revalidate before serving cache hit" rather than "do not store." `must-
// revalidate` reinforces the no-store directive for older intermediaries.
function withNoStore(res: Response): Response {
  res.headers.set("Cache-Control", "private, no-store, must-revalidate");
  return res;
}

export async function GET(req: Request): Promise<Response> {
  return withNoStore(await baseHandler.GET(req));
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const match = pickLimiter(url.pathname);
  if (match) {
    const ip = clientIpFromHeaders(req.headers);
    const body = await readJsonBody(req);
    const identifier = match.identifierFromBody(body) ?? "";
    const key = buildLimiterKey(match, ip, identifier);
    const result = consume(key, RATE_LIMITS[match.bucket]);
    if (!result.allowed) {
      return withNoStore(tooManyRequests(result));
    }
  }
  return withNoStore(await baseHandler.POST(req));
}
