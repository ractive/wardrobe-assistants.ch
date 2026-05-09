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
import { type MessageUserInput, messageUserInput } from "../schema";
import { messageUser } from "../server/actions";

export function MessageUserDialog({
  userId,
  displayName,
  email,
  open,
  onOpenChange,
}: {
  userId: string;
  displayName: string;
  email: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const form = useForm<MessageUserInput>({
    resolver: zodResolver(messageUserInput),
    defaultValues: { userId, subject: "", body: "" },
  });

  // Reset only when the dialog transitions open. userId is stable for the
  // dialog's lifetime; depending on `form` would re-fire on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment
  useEffect(() => {
    if (open) form.reset({ userId, subject: "", body: "" });
  }, [open]);

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const result = await messageUser(data);
      if (result.error) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    } catch (err) {
      // withPermission throws on session/permission failures.
      toast.error(
        err instanceof Error ? err.message : "Could not send message.",
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message {displayName}</DialogTitle>
          <DialogDescription>
            Sends an email to <span className="font-mono">{email}</span>.
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
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
