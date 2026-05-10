import "server-only";
import { services } from "@wardrobe-assistants/db/schema";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assertPermission } from "@/lib/permissions";
import { formatChf } from "../format";
import { type ServiceListItem, serviceListItem } from "../schema";

export async function listServices(opts?: {
  includeArchived?: boolean;
}): Promise<ServiceListItem[]> {
  // iter-16f / C-SEC-09: query is a security boundary on its own. Reuse the
  // create permission as the read gate — squad members don't see the catalog.
  await assertPermission("SERVICE_CREATE");
  const includeArchived = opts?.includeArchived ?? false;
  const baseQuery = db.select().from(services);
  const rows = await (includeArchived
    ? baseQuery
    : baseQuery.where(eq(services.archived, false))
  ).orderBy(asc(services.name));

  return rows.map((r) =>
    serviceListItem.parse({
      id: r.id,
      name: r.name,
      description: r.description,
      priceType: r.priceType,
      price: r.price,
      archived: r.archived,
      createdAt: r.createdAt,
      priceFormatted: formatChf(r.price, r.priceType),
    }),
  );
}
