"use client";

import { Archive, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ServiceListItem } from "../schema";
import { ArchiveServiceConfirm } from "./ArchiveServiceConfirm";
import { EditServiceDialog } from "./ServiceDialog";

export function ServiceActionsMenu({ service }: { service: ServiceListItem }) {
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Edit ${service.name}`}
                onClick={() => setEditOpen(true)}
              >
                <Pencil aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit service</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={
                  service.archived
                    ? `${service.name} is already archived`
                    : `Archive ${service.name}`
                }
                disabled={service.archived}
                onClick={() => setArchiveOpen(true)}
              >
                <Archive aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {service.archived ? "Already archived" : "Archive service"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

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
