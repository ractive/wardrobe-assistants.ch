"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            await authClient.signOut();
            router.replace("/login");
          } catch (error) {
            console.error("Sign out failed:", error);
            toast.error(
              error instanceof Error ? error.message : "Could not sign out.",
            );
          }
        });
      }}
      className="self-start rounded-md border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 font-medium text-sm disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
