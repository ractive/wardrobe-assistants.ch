import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServiceListItem } from "../schema";
import { ServiceActionsMenu } from "./ServiceActionsMenu";

export function ServicesTable({ services }: { services: ServiceListItem[] }) {
  if (services.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
        No services yet. Create your first offering to start building the
        catalog.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (≤ md) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {services.map((service) => (
          <li
            key={service.id}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-base">{service.name}</span>
                <span className="text-[var(--muted-foreground)] text-xs">
                  {service.description}
                </span>
              </div>
              <ServiceActionsMenu service={service} />
            </div>
            <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-[var(--muted-foreground)]">Type</dt>
              <dd>
                <StatusBadge kind="serviceType" status={service.priceType} />
              </dd>
              <dt className="text-[var(--muted-foreground)]">Price</dt>
              <dd>{service.priceFormatted}</dd>
              <dt className="text-[var(--muted-foreground)]">Status</dt>
              <dd>
                <StatusBadge
                  kind="serviceStatus"
                  status={service.archived ? "archived" : "active"}
                />
              </dd>
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: table (≥ md) */}
      <div className="hidden rounded-md border border-[var(--border)] md:block">
        <Table aria-label="Services">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{service.name}</span>
                    <span className="text-[var(--muted-foreground)] text-xs">
                      {service.description}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge kind="serviceType" status={service.priceType} />
                </TableCell>
                <TableCell>{service.priceFormatted}</TableCell>
                <TableCell>
                  <StatusBadge
                    kind="serviceStatus"
                    status={service.archived ? "archived" : "active"}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <ServiceActionsMenu service={service} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
