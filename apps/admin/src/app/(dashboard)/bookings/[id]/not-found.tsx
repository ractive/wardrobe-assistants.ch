import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function BookingNotFound() {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/bookings">
            <ArrowLeft className="size-4" aria-hidden="true" /> All bookings
          </Link>
        </Button>
      </div>
      <div className="flex flex-col items-start gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">
          Booking not found
        </h1>
        <p className="text-[var(--muted-foreground)] text-sm md:text-base">
          This booking may have been deleted or the link is wrong. Head back to
          the list to pick another.
        </p>
        <Button asChild>
          <Link href="/bookings">Back to bookings</Link>
        </Button>
      </div>
    </section>
  );
}
