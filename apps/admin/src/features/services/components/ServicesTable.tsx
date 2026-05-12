import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ServiceListItem } from "../schema";
import { ServiceActionsMenu } from "./ServiceActionsMenu";
import { ServiceTableRow } from "./ServiceTableRow";

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
      {/*
       * Whole-row click: ServiceTableRow is a client component that owns
       * edit-dialog state. Clicking anywhere on the row opens the edit dialog.
       * The ServiceActionsMenu (kebab) calls e.stopPropagation() so its own
       * interactions don't double-trigger the row handler.
       */}
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
              <ServiceTableRow key={service.id} service={service} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
