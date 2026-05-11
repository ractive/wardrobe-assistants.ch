import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  /** When provided the entire card renders as a Next.js Link. */
  href?: string;
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  description,
  href,
}: KpiCardProps) {
  const card = (
    <Card
      className={
        href
          ? "motion-safe:transition-colors motion-safe:duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {card}
      </Link>
    );
  }

  return card;
}
