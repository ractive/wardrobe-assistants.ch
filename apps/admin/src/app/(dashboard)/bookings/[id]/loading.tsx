import { Skeleton } from "@/components/ui/skeleton";

export default function EventDetailLoading() {
  return (
    <section
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading event details"
    >
      <Skeleton className="h-8 w-24" />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-56 md:h-9 md:w-72" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </header>
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4">
        <Skeleton className="h-4 w-24" />
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    </section>
  );
}
