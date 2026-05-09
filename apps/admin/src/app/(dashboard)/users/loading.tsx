import { Skeleton } from "@/components/ui/skeleton";

export default function UsersLoading() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32 md:h-9 md:w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full md:w-32" />
      </header>
      <TableSkeleton rows={5} />
    </section>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: rows }, (_, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            key={i}
            className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </li>
        ))}
      </ul>
      <div className="hidden rounded-md border border-[var(--border)] p-4 md:block">
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              key={i}
              className="grid grid-cols-6 gap-4"
            >
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
