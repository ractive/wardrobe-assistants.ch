import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-8 md:px-0 md:py-12">
      <h1 className="font-semibold text-2xl md:text-3xl">Page not found</h1>
      <p className="text-[var(--muted-foreground)] text-sm md:text-base">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Back to dashboard</Link>
      </Button>
    </section>
  );
}
