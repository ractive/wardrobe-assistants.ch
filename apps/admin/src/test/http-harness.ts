// HTTP smoke-test harness — spins up a fresh in-process libSQL, runs the
// real Drizzle migrations, and hands back a real `auth` instance + helpers
// for sign-in and role seeding. The point is to catch the iter-15b class of
// bug — schema/auth wiring that 500s only when it touches a real DB — at
// PR time, not at prod smoke.
//
// Usage: see apps/admin/src/test/http-harness.test.ts.
//
// What this harness does NOT do:
//   - It does not run a Next.js server. Server actions that call
//     `next/headers` need a per-test-file mock that returns
//     `harness.activeCookies()`. See `runAs()` for the helper that scopes a
//     cookie set to a single call.
//   - It does not isolate one test from another via vi.resetModules. The
//     auth singleton is reused across tests in the same file, but the libSQL
//     file is unique per setupHarness() call and gets nuked on cleanup —
//     that's enough to keep tests independent.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Database } from "@wardrobe-assistants/db";
import { vi } from "vitest";

// 64-hex placeholder — iter-13's env validator requires this shape in
// production. NODE_ENV=test below skips the prod tripwire, but a 64-char
// value future-proofs against schema tightening.
const TEST_BETTER_AUTH_SECRET = "0".repeat(64);

// Module-scope cookie holder. Tests that call server actions which read
// `next/headers` should:
//   1) `vi.mock("next/headers", () => ({ headers: () => Promise.resolve(harness.activeCookies()) }))`
//   2) wrap the call in `harness.runAs(cookies, () => action())`.
// Single shared variable keeps the mock implementation trivially small.
//
// Concurrency caveat: vitest workers run test files in separate processes,
// so this state never leaks across files. Within a single test file, do
// NOT run two `runAs` calls in parallel via `Promise.all` — they'd race
// on this variable. Smoke tests are sequential by design.
let activeCookies: Headers = new Headers();

/**
 * Header-presence helper for smoke tests. Pulls the configured `headers()`
 * block from `next.config.ts` and asserts each named header is present on
 * the catch-all `/(.*)` source. Next.js applies these to every response, so
 * validating the *config* (not a live HTTP fetch) is the right level: the
 * vitest harness has no Next runtime, but the config is the authoritative
 * source of truth for what the server will emit.
 *
 * Usage:
 *   await assertSecurityHeadersConfigured([
 *     "Cache-Control",
 *     "X-Frame-Options",
 *     ...
 *   ]);
 */
export async function assertSecurityHeadersConfigured(
  expected: readonly string[],
): Promise<void> {
  const cfg = await import("../../next.config");
  const headers = await cfg.default.headers?.();
  if (!headers) {
    throw new Error("next.config headers() is not configured");
  }
  const catchAll = headers.find((h) => h.source === "/(.*)");
  if (!catchAll) {
    throw new Error("next.config headers() has no /(.*) catch-all source");
  }
  const present = new Set(catchAll.headers.map((h) => h.key));
  const missing = expected.filter((k) => !present.has(k));
  if (missing.length > 0) {
    throw new Error(`Missing security headers: ${missing.join(", ")}`);
  }
}

export interface Harness {
  /** Tmp libSQL DB used by both `auth` and direct queries. */
  db: Database;
  /** Real Better Auth instance, wired to the tmp DB. */
  auth: typeof import("../lib/auth").auth;
  /** Drop the tmp DB file. Call from `afterAll` (or `afterEach` if you want
   *  per-test isolation at the cost of running migrations N times). */
  cleanup: () => void;
  /** Sign up + sign in. Returns a `Headers` object with the auth cookie set
   *  on `cookie:`, ready to feed into auth.api.* or runAs(). */
  signUpAndSignIn: (opts: SignUpOpts) => Promise<Headers>;
  /** Sign up + sign in + insert ADMIN-role user_profile. */
  seedAdmin: (opts: SeedOpts) => Promise<SeededUser>;
  /** Sign up + sign in + insert SQUAD_MEMBER-role user_profile. */
  seedSquadMember: (opts: SeedOpts) => Promise<SeededUser>;
  /** Cookies the per-file `vi.mock("next/headers")` should return. Updated
   *  by `runAs`. */
  activeCookies: () => Headers;
  /** Run `fn` with the active-cookies value swapped to `cookies`, restoring
   *  the previous value (typically `new Headers()`) on exit. */
  runAs: <T>(cookies: Headers, fn: () => Promise<T>) => Promise<T>;
}

interface SignUpOpts {
  email: string;
  password: string;
  name?: string;
}

interface SeedOpts extends SignUpOpts {
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
}

export interface SeededUser {
  userId: string;
  cookies: Headers;
}

export async function setupHarness(): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), "wa-smoke-"));
  const dbFile = join(dir, "smoke.db");

  // Stub env BEFORE the dynamic imports below — the env Proxy in lib/env.ts
  // caches on first access, so we need the right values in place before the
  // first read.
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", `file:${dbFile}`);
  vi.stubEnv("DATABASE_AUTH_TOKEN", "");
  vi.stubEnv("BETTER_AUTH_SECRET", TEST_BETTER_AUTH_SECRET);
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  vi.stubEnv("EMAIL_FROM", "test@example.test");
  vi.stubEnv("RESEND_API_KEY", "test");

  // Reset the module cache so lib/env, lib/db, lib/auth re-evaluate against
  // the stubbed env. Without this, a previous test in the same vitest worker
  // could have cached a different DATABASE_URL.
  vi.resetModules();

  const { runMigrations } = await import("../lib/migrate");
  await runMigrations();

  const { db } = await import("../lib/db");
  const { auth } = await import("../lib/auth");
  const { schema } = await import("@wardrobe-assistants/db/schema");

  async function signUpAndSignIn({
    email,
    password,
    name,
  }: SignUpOpts): Promise<Headers> {
    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: name ?? email },
      headers: new Headers(),
    });
    if (!signUp || !("user" in signUp)) {
      throw new Error(`signUpEmail failed for ${email}`);
    }
    const res = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `signInEmail failed for ${email}: ${res.status} ${body.slice(0, 200)}`,
      );
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error(`signInEmail returned no set-cookie for ${email}`);
    }
    const cookies = new Headers();
    cookies.set("cookie", setCookie);
    return cookies;
  }

  async function seedRole(
    role: "ADMIN" | "SQUAD_MEMBER",
    opts: SeedOpts,
  ): Promise<SeededUser> {
    // Sign up (creates the Better Auth user row, no session yet).
    const signUp = await auth.api.signUpEmail({
      body: {
        email: opts.email,
        password: opts.password,
        name: opts.name ?? opts.email,
      },
      headers: new Headers(),
    });
    if (!signUp || !("user" in signUp)) {
      throw new Error(`signUpEmail failed for ${opts.email}`);
    }
    const userId = signUp.user.id;

    // Insert the domain-side profile BEFORE signing in. Permission checks
    // read role from `user_profile` at request time (since iter-15c — see
    // `roleForUserId` in lib/auth.ts), so the order of seed-vs-sign-in does
    // not affect the cookie's session payload. Inserting first still lets
    // the session.create.before hook see status=verified on the user's
    // first sign-in, avoiding the verified-flip write entirely.
    const now = new Date();
    await db.insert(schema.userProfile).values({
      userId,
      firstName: opts.firstName ?? "Test",
      lastName: opts.lastName ?? "User",
      nickname: opts.nickname ?? null,
      mobileNumber: null,
      role,
      status: "verified",
      invitedAt: now,
      verifiedAt: now,
    });

    const res = await auth.api.signInEmail({
      body: { email: opts.email, password: opts.password },
      asResponse: true,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `signInEmail failed for ${opts.email}: ${res.status} ${body.slice(0, 200)}`,
      );
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) {
      throw new Error(`signInEmail returned no set-cookie for ${opts.email}`);
    }
    const cookies = new Headers();
    cookies.set("cookie", setCookie);
    return { userId, cookies };
  }

  return {
    db,
    auth,
    cleanup() {
      // Unstub env so a later test file in the same vitest worker doesn't
      // inherit our DATABASE_URL / NODE_ENV / etc. and accidentally hit our
      // (now-deleted) tmp DB.
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    },
    signUpAndSignIn,
    seedAdmin: (opts) => seedRole("ADMIN", opts),
    seedSquadMember: (opts) => seedRole("SQUAD_MEMBER", opts),
    activeCookies: () => activeCookies,
    async runAs<T>(cookies: Headers, fn: () => Promise<T>): Promise<T> {
      const prev = activeCookies;
      activeCookies = cookies;
      try {
        return await fn();
      } finally {
        activeCookies = prev;
      }
    },
  };
}
