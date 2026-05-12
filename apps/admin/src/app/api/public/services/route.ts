// iter-26: public, unauthenticated services catalog. Consumed by the homepage
// `/booking-request` page at build time. CORS-restricted to the production
// homepage origins (plus localhost in dev) via `isAllowedOrigin`.
//
// Output shape mirrors the iter-26 plan §4: `{ id, name, description,
// priceType, price }` for non-archived services. `price` is a whole-CHF
// integer matching `services.price`; no centimes anywhere in the wire format.
import { services } from "@wardrobe-assistants/db/schema";
import { publicServicesResponseSchema } from "@wardrobe-assistants/shared/public-services-schema";
import { asc, eq } from "drizzle-orm";
import { corsHeaders, isAllowedOrigin } from "@/lib/cors";
import { db } from "@/lib/db";
import {
  clientIpFromHeaders,
  consume,
  RATE_LIMITS,
  retryAfterSeconds,
} from "@/lib/rate-limit";

export async function OPTIONS(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  // Build-time fetches (Node, no Origin) and same-origin requests are allowed
  // through with no CORS headers attached; cross-origin browser fetches are
  // gated to the allowlist.
  const baseHeaders = new Headers({ "Content-Type": "application/json" });
  if (origin !== null) {
    if (!isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: baseHeaders,
      });
    }
    for (const [k, v] of corsHeaders(origin)) {
      baseHeaders.set(k, v);
    }
  }

  const ip = clientIpFromHeaders(req.headers);
  const rl = consume(
    `publicServices:${ip}`,
    RATE_LIMITS.publicServicesPerIpMinute,
  );
  if (!rl.allowed) {
    baseHeaders.set("Retry-After", String(retryAfterSeconds(rl)));
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: baseHeaders,
    });
  }

  try {
    const rows = await db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        priceType: services.priceType,
        price: services.price,
      })
      .from(services)
      .where(eq(services.archived, false))
      .orderBy(asc(services.name));

    // iter-34 §6: validate the response shape against the shared schema so
    // the wire contract is defended at both ends. Drizzle row shapes already
    // match by construction, so a parse failure here is a real bug — log
    // loudly and signal an internal error so consumers (and ops dashboards)
    // can see it; serving an empty 200 would mask the regression.
    const parsed = publicServicesResponseSchema.safeParse({ services: rows });
    if (!parsed.success) {
      console.error(
        "[public/services] response failed schema validation",
        parsed.error.flatten(),
      );
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: baseHeaders,
      });
    }
    return new Response(JSON.stringify(parsed.data), {
      status: 200,
      headers: baseHeaders,
    });
  } catch (err) {
    console.error("[public/services] db query failed", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: baseHeaders,
    });
  }
}
