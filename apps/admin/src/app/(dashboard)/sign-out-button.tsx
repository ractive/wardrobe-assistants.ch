"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
          router.replace("/login");
        } catch (error) {
          console.error("Sign out failed:", error);
          toast.error(
            error instanceof Error ? error.message : "Could not sign out.",
          );
          setPending(false);
        }
      }}
      className="self-start rounded-md border border-[var(--border)] bg-[var(--secondary)] px-4 py-2 font-medium text-sm disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
