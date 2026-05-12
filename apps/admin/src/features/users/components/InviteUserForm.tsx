"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteUserInput } from "../schema";
import { inviteUser } from "../server/actions";

export function InviteUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(inviteUserInput),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      nickname: "",
      mobileNumber: "",
      role: "SQUAD_MEMBER",
    },
  });

  const [state, actionDispatch] = useActionState(
    async (
      _prevState: { error?: unknown; message?: string } | null,
      data: Parameters<typeof inviteUser>[0],
    ) => inviteUser(data),
    null,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally fires only when state changes; router/form are stable references that do not need to trigger re-runs
  useEffect(() => {
    if (!state) return;
    if (state.error) {
      toast.error(state.message ?? "Could not send invitation.");
    } else {
      toast.success(state.message ?? "Done.");
      form.reset();
      onSuccess?.();
      router.refresh();
    }
  }, [state, onSuccess]);

  const onSubmit = form.handleSubmit((data) => actionDispatch(data));

  return (
    <Form {...form}>
      <form method="post" onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="off"
                  placeholder="person@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nickname (optional)</FormLabel>
                <FormControl>
                  <Input autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mobileNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mobile (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    autoComplete="off"
                    placeholder="+41 79 123 45 67"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SQUAD_MEMBER">Squad member</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {/* RHF's isSubmitting tracks the awaited useActionState dispatch
              (its returned promise resolves when the server action settles). */}
          {form.formState.isSubmitting ? "Sending invite…" : "Send invite"}
        </Button>
      </form>
    </Form>
  );
}
