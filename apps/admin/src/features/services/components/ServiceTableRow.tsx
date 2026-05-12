"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ServiceListItem } from "../schema";
import { ServiceActionsMenu } from "./ServiceActionsMenu";
import { EditServiceDialog } from "./ServiceDialog";

interface ServiceTableRowProps {
  service: ServiceListItem;
}

/**
 * Client component that owns edit-dialog state for a single service row.
 *
 * Clicking anywhere on the row opens the edit dialog. Keyboard users reach
 * the visually-hidden "Edit" button in the first cell — making this
 * accessible without nesting role="button" inside the row (which would
 * trigger the nested-interactive a11y violation).
 *
 * The actions cell stops click propagation so the kebab menu doesn't
 * also trigger the row handler.
 */
export function ServiceTableRow({ service }: ServiceTableRowProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={(e) => {
          // Only trigger if the click didn't come from a descendant button/link.
          const target = e.target as HTMLElement;
          if (target.closest("button, a, [role=menuitem]")) return;
          setEditOpen(true);
        }}
      >
        <TableCell>
          <div className="flex flex-col gap-1">
            {/* Visually-hidden button is the keyboard / AT entry point */}
            <button
              type="button"
              className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:rounded focus:bg-background focus:px-2 focus:py-1 focus:text-sm focus:ring-2 focus:ring-ring"
              onClick={() => setEditOpen(true)}
              aria-label={`Edit service ${service.name}`}
            >
              Edit
            </button>
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
        {/*
         * stopPropagation on the actions cell: prevents the row onClick from
         * firing when the user interacts with the kebab menu.
         */}
        <TableCell
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-end">
            <ServiceActionsMenu service={service} />
          </div>
        </TableCell>
      </TableRow>

      <EditServiceDialog
        defaults={{
          serviceId: service.id,
          name: service.name,
          description: service.description,
          priceType: service.priceType,
          price: service.price,
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
