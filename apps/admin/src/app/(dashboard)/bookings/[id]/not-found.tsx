import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EventNotFound() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/events">
            <ArrowLeft className="size-4" aria-hidden="true" /> All events
          </Link>
        </Button>
      </div>
      <div className="flex flex-col items-start gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Event not found</h1>
        <p className="text-[var(--muted-foreground)] text-sm md:text-base">
          This event may have been deleted or the link is wrong. Head back to
          the list to pick another.
        </p>
        <Button asChild>
          <Link href="/events">Back to events</Link>
        </Button>
      </div>
    </section>
  );
}
