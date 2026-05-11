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
import type { EditDefaults } from "./BookingForm";
import { BookingForm } from "./BookingForm";

export function CreateBookingDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create booking</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create booking</DialogTitle>
          <DialogDescription>
            Schedule a new booking. You can assign squad members afterwards from
            the booking detail page.
          </DialogDescription>
        </DialogHeader>
        <BookingForm mode="create" onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditBookingDialog({
  defaults,
  open,
  onOpenChange,
}: {
  defaults: EditDefaults;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit booking</DialogTitle>
          <DialogDescription>
            Update booking details or notes.
          </DialogDescription>
        </DialogHeader>
        <BookingForm
          mode="edit"
          defaults={defaults}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
