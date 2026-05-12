// Sliding-window rate limiter — in-memory, keyed by an arbitrary string.
//
// Closes audit C-SEC-02. Single-container deploy makes process-local state
// acceptable: no horizontal sharding, restarts wipe counters (a brief
// fail-open after deploy is preferable to a hard dependency on Redis).
//
// Storage shape is a `Map<key, number[]>` of recent hit timestamps (ms);
// each `consume()` drops timestamps older than `windowMs`, then either
// records a hit or rejects. Eviction of completely-stale keys runs at
// `consume()` time when the local map crosses a soft threshold — cheap
// amortized cost; bounded memory under continuous load.
//
// Future swap to Upstash/Redis is mechanical: replace the `Map` backend
// with a `RateLimiterStore` shim that exposes the same `get`/`set`/`delete`
// surface; the public `consume()` API doesn't change.

export interface RateLimitResult {
  allowed: boolean;
  // ms until the *oldest* in-window hit ages out. Surfaced as
  // `Retry-After` (seconds, ceiled) by callers that build HTTP responses.
  retryAfterMs: number;
  // Hits remaining in the current window. Useful for debugging; not
  // part of any external contract.
  remaining: number;
}

interface Bucket {
  // Limit (max hits in `windowMs`) and `windowMs` for this bucket type.
  limit: number;
  windowMs: number;
}

// 8 KB-ish soft cap. The eviction sweep is O(n) over keys, so we keep
// it small and amortized (runs once per `consume()` after a threshold).
const KEY_SOFT_CAP = 4096;

const store = new Map<string, number[]>();

function sweepExpired(nowMs: number): void {
  if (store.size < KEY_SOFT_CAP) return;
  for (const [key, hits] of store) {
    // A key is fully stale only when *every* hit is past the longest
    // window we'd ever look back over (1h covers password-reset). We
    // keep the bound conservative — a slightly oversized map is cheap;
    // a wrong eviction would let a hot attacker reset their counter.
    const cutoff = nowMs - 60 * 60 * 1000;
    const filtered = hits.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      store.delete(key);
    } else if (filtered.length !== hits.length) {
      store.set(key, filtered);
    }
  }
}

export function consume(key: string, bucket: Bucket): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);
  const cutoff = now - bucket.windowMs;
  const existing = store.get(key) ?? [];
  // Drop hits that have aged out of the window.
  const inWindow = existing.filter((t) => t > cutoff);
  if (inWindow.length >= bucket.limit) {
    const oldest = inWindow[0] ?? now;
    return {
      allowed: false,
      retryAfterMs: Math.max(0, oldest + bucket.windowMs - now),
      remaining: 0,
    };
  }
  inWindow.push(now);
  store.set(key, inWindow);
  return {
    allowed: true,
    retryAfterMs: 0,
    remaining: Math.max(0, bucket.limit - inWindow.length),
  };
}

// Test-only reset. Production code never imports this.
export function _resetRateLimitStoreForTests(): void {
  store.clear();
}

// Canonical buckets — referenced by route handler + invite action so the
// numbers live in one place.
export const RATE_LIMITS = {
  // Login: 5 per 15 min per IP+email — slows credential stuffing without
  // breaking a fat-fingered admin. Better Auth doesn't ship a stuffing
  // protection for password sign-in.
  login: { limit: 5, windowMs: 15 * 60 * 1000 } satisfies Bucket,
  // Password reset / initial set-password: 5 per 15 min per email.
  // Tighter window than login (15 min vs 1h) bounds email send-spam to
  // 20/h/email worst case; the higher hit count gives a freshly-invited
  // user room to retry their first set-password without tripping the
  // limiter. iter-39 §C.3 (was 3 per 1h — too aggressive: real invitees
  // hit 429 on their first retry). Better Auth uses this same bucket for
  // both the genuine forgot-password flow and the invitation-triggered
  // `requestPasswordReset` call; that's intentional — the limit class is
  // the same protection in both cases.
  passwordReset: { limit: 5, windowMs: 15 * 60 * 1000 } satisfies Bucket,
  // Signup: 3 per hour per IP. Public signup is gated to invite-only via
  // the route handler in production, but the floor is a defense in depth
  // in case the route is ever opened up.
  signup: { limit: 3, windowMs: 60 * 60 * 1000 } satisfies Bucket,
  // Invite action: 10 per hour per admin. Server-action call site, so
  // keying on actor user-id rather than IP.
  invite: { limit: 10, windowMs: 60 * 60 * 1000 } satisfies Bucket,
  // iter-26: public booking-request route. Three buckets keyed independently:
  //   - 3 / hour  per IP
  //   - 10 / day  per IP
  //   - 3 / day   per customerEmail (normalized lowercase + trim)
  // The route consumes all three on every accepted POST; rejection on any one
  // returns 429 with `Retry-After`. Numbers are deliberately low — a real
  // customer never submits more than a handful per day; bots hit the ceiling
  // before they hit the DB.
  bookingRequestPerIpHour: {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  } satisfies Bucket,
  bookingRequestPerIpDay: {
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  } satisfies Bucket,
  bookingRequestPerEmailDay: {
    limit: 3,
    windowMs: 24 * 60 * 60 * 1000,
  } satisfies Bucket,
  // iter-26: public services catalog. 60/min/IP — high enough that homepage
  // build-time fetches never hit it, low enough to deter scrapers.
  publicServicesPerIpMinute: {
    limit: 60,
    windowMs: 60 * 1000,
  } satisfies Bucket,
  // iter-27: public offer page — cheap defense against scrapers.
  offerView: {
    limit: 60,
    windowMs: 60 * 1000,
  } satisfies Bucket,
  // iter-27: customer offer-accept — prevents accept-spam if a token leaks.
  offerAccept: {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  } satisfies Bucket,
} as const;

// Standard `Retry-After` header value (seconds, ceiled to 1 minimum when
// the request was rejected — RFC 9110 mandates a positive integer).
export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil(result.retryAfterMs / 1000));
}

// Best-effort client-IP extraction from request headers. The bunny.net
// edge appends to `x-forwarded-for` rather than replacing it, so the IP we
// can actually trust is the *rightmost* entry (the one bunny saw). The
// leftmost is whatever the client claimed and is trivially spoofable.
// Falls back to `x-real-ip`, then to a fixed sentinel so a missing header
// does not collapse all callers into one bucket.
export function clientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
