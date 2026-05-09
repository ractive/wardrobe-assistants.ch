"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type MessageEventAssigneesInput,
  messageEventAssigneesInput,
} from "../schema";
import { messageEventAssignees } from "../server/actions";

export function MessageAssigneesDialog({
  eventId,
  eventName,
  assigneesCount,
  open,
  onOpenChange,
}: {
  eventId: string;
  eventName: string;
  assigneesCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<MessageEventAssigneesInput>({
    resolver: zodResolver(messageEventAssigneesInput),
    defaultValues: { eventId, subject: "", body: "" },
  });

  // Reset only when the dialog transitions open. eventId is stable for the
  // dialog's lifetime; depending on `form` would re-fire on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment
  useEffect(() => {
    if (open) form.reset({ eventId, subject: "", body: "" });
  }, [open]);

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const result = await messageEventAssignees(data);
      if (result.error) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send.");
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (form.formState.isSubmitting && !next) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message assignees of {eventName}</DialogTitle>
          <DialogDescription>
            {assigneesCount === 0
              ? "No assignees on this event yet."
              : `Sends an email to ${assigneesCount} ${
                  assigneesCount === 1 ? "person" : "people"
                }.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || assigneesCount === 0}
              >
                {form.formState.isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
