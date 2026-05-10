"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ServiceListItem } from "../schema";
import { ArchiveServiceConfirm } from "./ArchiveServiceConfirm";
import { EditServiceDialog } from "./ServiceDialog";

export function ServiceActionsMenu({ service }: { service: ServiceListItem }) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${service.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={service.archived}
            onSelect={() => setArchiveOpen(true)}
            className="text-[var(--destructive)] focus:text-[var(--destructive)]"
          >
            {service.archived ? "Already archived" : "Archive"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
      <ArchiveServiceConfirm
        serviceId={service.id}
        serviceName={service.name}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </>
  );
}
