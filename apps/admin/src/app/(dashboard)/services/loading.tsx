import { Skeleton } from "@/components/ui/skeleton";

export default function ServicesLoading() {
  return (
    <section
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Loading services"
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32 md:h-9 md:w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full md:w-32" />
      </header>
      <ul className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
            key={i}
            className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </li>
        ))}
      </ul>
      <div className="hidden rounded-md border border-[var(--border)] p-4 md:block">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              key={i}
              className="grid grid-cols-5 gap-4"
            >
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
