// @vitest-environment node
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchServices, isCatalogRequired } from "./_services";

const ADMIN_ORIGIN = "https://admin.example.com";

const SERVICE = {
  id: "svc-1",
  name: "Quick changes",
  description: null,
  priceType: "hourly",
  price: 100,
} as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("isCatalogRequired", () => {
  it("is required for production builds", () => {
    expect(isCatalogRequired({ NODE_ENV: "production" })).toBe(true);
  });

  it("can be opted out of with HOMEPAGE_ALLOW_EMPTY_CATALOG=1", () => {
    expect(
      isCatalogRequired({
        NODE_ENV: "production",
        HOMEPAGE_ALLOW_EMPTY_CATALOG: "1",
      }),
    ).toBe(false);
  });

  it("is not required outside production", () => {
    expect(isCatalogRequired({ NODE_ENV: "development" })).toBe(false);
    expect(isCatalogRequired({ NODE_ENV: "test" })).toBe(false);
    expect(isCatalogRequired({})).toBe(false);
  });
});

describe("fetchServices", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the admin endpoint without a request-time cache option", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ services: [SERVICE] }));
    const services = await fetchServices({
      adminOrigin: ADMIN_ORIGIN,
      required: true,
      fetchImpl,
    });
    expect(services).toEqual([SERVICE]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit & { next?: unknown },
    ];
    expect(url).toBe(`${ADMIN_ORIGIN}/api/public/services`);
    // Static export rejects `cache: "no-store"` / `next.revalidate: 0`.
    expect(init.cache).toBeUndefined();
    expect(init.next).toBeUndefined();
  });

  it("returns a valid empty catalog without failing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ services: [] }));
    await expect(
      fetchServices({ adminOrigin: ADMIN_ORIGIN, required: true, fetchImpl }),
    ).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalled();
  });

  const failures: [string, () => Promise<Response>, RegExp][] = [
    [
      "a non-2xx response",
      async () => new Response("nope", { status: 503 }),
      /HTTP 503/,
    ],
    [
      "a response that fails schema validation",
      async () => jsonResponse({ services: [{ id: "" }] }),
      /schema validation/,
    ],
    [
      "a network error",
      async () => {
        throw new TypeError("fetch failed");
      },
      /fetch failed/,
    ],
  ];

  describe.each(failures)("on %s", (_label, impl, reason) => {
    it("fails when the catalog is required", async () => {
      const fetchImpl = vi.fn(impl);
      await expect(
        fetchServices({ adminOrigin: ADMIN_ORIGIN, required: true, fetchImpl }),
      ).rejects.toThrow(reason);
      await expect(
        fetchServices({ adminOrigin: ADMIN_ORIGIN, required: true, fetchImpl }),
      ).rejects.toThrow(/HOMEPAGE_ALLOW_EMPTY_CATALOG=1/);
    });

    it("degrades to an empty catalog when not required", async () => {
      const fetchImpl = vi.fn(impl);
      await expect(
        fetchServices({
          adminOrigin: ADMIN_ORIGIN,
          required: false,
          fetchImpl,
        }),
      ).resolves.toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  it("rethrows Next.js request-time bail-outs instead of degrading", async () => {
    // Shape of the DynamicServerError Next throws for `cache: "no-store"`
    // under static export: the error that used to be swallowed here.
    const bailout = Object.assign(new Error("Dynamic server usage: no-store"), {
      digest: "DYNAMIC_SERVER_USAGE",
    });
    const fetchImpl = vi.fn(async () => {
      throw bailout;
    });
    await expect(
      fetchServices({ adminOrigin: ADMIN_ORIGIN, required: false, fetchImpl }),
    ).rejects.toBe(bailout);
  });

  it("times out an unresponsive admin", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    await expect(
      fetchServices({
        adminOrigin: ADMIN_ORIGIN,
        required: true,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/could not load the services catalog/);
  });
});

describe("homepage build script", () => {
  it("clears Next's persisted fetch cache before building", () => {
    // Otherwise a cached catalog response is reused for up to a year and an
    // unreachable admin no longer fails the build (see _services.ts).
    const pkg = JSON.parse(
      readFileSync(
        new URL("../../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toMatch(
      /rm -rf \.next\/cache\/fetch-cache && next build/,
    );
  });
});
