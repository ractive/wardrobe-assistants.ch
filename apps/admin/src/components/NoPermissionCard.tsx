import { cn } from "@/lib/utils";

export function NoPermissionCard({
  className,
  message = "You don't have permission to view this.",
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-[var(--border)] bg-[var(--card)] p-4 text-[var(--muted-foreground)] text-sm",
        className,
      )}
      role="status"
    >
      {message}
    </div>
  );
}
