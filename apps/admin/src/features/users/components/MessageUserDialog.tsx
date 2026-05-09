"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { useFormAction } from "@/hooks/use-form-action";
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
  const form = useForm({
    resolver: zodResolver(messageUserInput),
    defaultValues: { userId, subject: "", body: "" },
  });

  // Reset on open or userId change. `form` is omitted because it's stable
  // from useForm and depending on it would re-fire on every render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: form is stable
  useEffect(() => {
    if (open) form.reset({ userId, subject: "", body: "" });
  }, [open, userId]);

  const submit = useFormAction(messageUser, {
    onSuccess: () => onOpenChange(false),
    refresh: false,
    fallbackErrorMessage: "Could not send message.",
  });

  const onSubmit = form.handleSubmit((data) => submit(data));

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
          <form method="post" onSubmit={onSubmit} className="space-y-4">
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
