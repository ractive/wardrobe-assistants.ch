"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PriceType } from "../schema";
import { ServiceForm } from "./ServiceForm";

export function CreateServiceDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New service</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New service</DialogTitle>
          <DialogDescription>
            Add an offering to the catalog. Prices are whole CHF; archive a
            service to retire it without affecting historical events.
          </DialogDescription>
        </DialogHeader>
        <ServiceForm mode="create" onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditServiceDialog({
  defaults,
  open,
  onOpenChange,
}: {
  defaults: {
    serviceId: string;
    name: string;
    description: string;
    priceType: PriceType;
    price: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit service</DialogTitle>
          <DialogDescription>
            Renaming or repricing only affects future events — historical line
            items are snapshotted at billing time.
          </DialogDescription>
        </DialogHeader>
        <ServiceForm
          mode="edit"
          defaults={defaults}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
