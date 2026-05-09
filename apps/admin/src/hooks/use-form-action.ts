"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";

// Loose shape — every feature's action returns a discriminated union
// `{ error: false, message } | { error: true, message }`, but typing the hook
// against the boolean discriminant would force every caller to widen its
// generic. Truthy `error` is the contract, identical to the inlined try/catch
// pattern this hook replaces.
type ActionResult = { error?: unknown; message?: string };

/**
 * Wraps a server action with the standard toast-on-result + router.refresh
 * flow. Replaces the duplicated try/catch/toast block in every form (~20
 * lines per call site). The thrown-error path covers `withPermission`'s
 * `PermissionError` / `UnauthenticatedError`.
 */
export function useFormAction<I, R extends ActionResult>(
  action: (input: I) => Promise<R>,
  opts?: { onSuccess?: (result: R) => void; refresh?: boolean },
): (input: I) => Promise<void> {
  const router = useRouter();
  const onSuccess = opts?.onSuccess;
  const refresh = opts?.refresh ?? true;
  return useCallback(
    async (input: I) => {
      try {
        const result = await action(input);
        if (result.error) {
          toast.error(result.message ?? "Something went wrong.");
          return;
        }
        toast.success(result.message ?? "Done.");
        onSuccess?.(result);
        if (refresh) router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    },
    [action, onSuccess, refresh, router],
  );
}
