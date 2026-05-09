import { Shirt } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandBadgeProps {
  className?: string;
}

export function BrandBadge({ className }: BrandBadgeProps) {
  return (
    <Link
      href="/"
      aria-label="Wardrobe Assistants — go to dashboard"
      className={cn(
        "flex flex-col items-center gap-2 self-center font-medium",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Shirt className="size-8" aria-hidden="true" />
      </div>
      <span>Wardrobe Assistants</span>
    </Link>
  );
}
