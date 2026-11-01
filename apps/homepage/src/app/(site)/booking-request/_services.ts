// Build-time fetch of the public services catalog for /booking-request.
//
// The homepage is `output: "export"`, so this runs once during `next build`
// and the result is baked into the static HTML. Two rules follow from that:
//
// 1. No `cache: "no-store"` / `next.revalidate: 0`. Under static export Next
//    treats those as request-time APIs and throws a bail-out error. That error
//    used to be swallowed by our catch block, so prod shipped an empty
//    catalog. `unstable_rethrow` below keeps any such framework error from
//    being mistaken for a fetch failure again.
// 2. A production build must not silently ship an empty catalog. Any fetch
//    failure (network, timeout, non-2xx, schema mismatch) fails the build, in
//    the same spirit as `assertOperatorReady` in site-config.ts. The deploy
//    job then stops before uploading, so the previous build stays live.
//    `next dev` keeps the old degrade-to-empty behaviour so the page still
//    renders when the admin app isn't running locally. Set
//    `HOMEPAGE_ALLOW_EMPTY_CATALOG=1` to force a production build through
//    anyway (e.g. an offline local build).
//
// 3. Without a cache option, Next stores the build-time response in
//    `.next/cache/fetch-cache` with a one-year lifetime and reuses it on the
//    next build in the same checkout: no network call, so neither catalog
//    changes nor an admin outage would be noticed. The homepage `build`
//    script deletes that directory before `next build` for that reason (the
//    export worker ignores `experimental.isrFlushToDisk`). Never persist
//    `.next/cache` between builds (e.g. actions/cache) for this app.
//
// A *valid* empty list (admin has no active services) is not an error: the
// form renders its email-fallback message.

import { publicServicesResponseSchema } from "@wardrobe-assistants/shared/public-services-schema";
import { unstable_rethrow } from "next/navigation";
import type { ServiceEntry } from "./_form";

const FETCH_TIMEOUT_MS = 8000;

export function isCatalogRequired(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.NODE_ENV === "production" && env.HOMEPAGE_ALLOW_EMPTY_CATALOG !== "1"
  );
}

type FetchServicesOptions = {
  adminOrigin: string;
  required?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export async function fetchServices({
  adminOrigin,
  required = isCatalogRequired(),
  fetchImpl = fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
}: FetchServicesOptions): Promise<ServiceEntry[]> {
  const url = `${adminOrigin}/api/public/services`;
  try {
    const services = await loadServices(url, fetchImpl, timeoutMs);
    if (services.length === 0) {
      console.warn(
        `[booking-request] ${url} returned an empty catalog; the form will show the email fallback.`,
      );
    }
    return services;
  } catch (err) {
    unstable_rethrow(err);
    if (required) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[booking-request] could not load the services catalog from ${url}: ${reason}. ` +
          "Refusing to build /booking-request with an empty catalog. " +
          "Set HOMEPAGE_ALLOW_EMPTY_CATALOG=1 to build without it.",
        { cause: err },
      );
    }
    console.error(
      "[booking-request] services fetch failed; rendering an empty catalog",
      err,
    );
    return [];
  }
}

async function loadServices(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<ServiceEntry[]> {
  const res = await fetchImpl(url, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  }
  // iter-34 §6: runtime-validate against the shared schema so the admin and
  // the homepage agree on the wire shape.
  const json: unknown = await res.json();
  const parsed = publicServicesResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `response failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data.services satisfies ServiceEntry[];
}
