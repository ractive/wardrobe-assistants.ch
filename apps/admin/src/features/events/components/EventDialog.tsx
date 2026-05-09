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
import type { EVENT_STATUSES } from "../schema";
import { EventForm } from "./EventForm";

export function CreateEventDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create event</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>
            Schedule a new event. You can assign squad members afterwards from
            the event detail page.
          </DialogDescription>
        </DialogHeader>
        <EventForm mode="create" onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function EditEventDialog({
  defaults,
  open,
  onOpenChange,
}: {
  defaults: {
    eventId: string;
    name: string;
    date: Date;
    venue: string;
    notes: string | null;
    status: (typeof EVENT_STATUSES)[number];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>
            Update event details, status, or notes.
          </DialogDescription>
        </DialogHeader>
        <EventForm
          mode="edit"
          defaults={defaults}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
