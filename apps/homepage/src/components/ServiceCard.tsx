import type { Icon } from "@/components/icons";

interface ServiceCardProps {
  icon: Icon;
  title: string;
  description: string;
}

export function ServiceCard({
  icon: Icon,
  title,
  description,
}: ServiceCardProps) {
  return (
    <div className="flex flex-col gap-5 rounded-[20px] border border-[var(--border)] bg-[var(--accent)]/80 p-7">
      <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--secondary)]">
        <Icon className="h-[22px] w-[22px] text-[var(--muted-foreground)]" />
      </div>
      <h3 className="font-primary text-[20px] font-bold leading-[1.2] text-[var(--foreground)]">
        {title}
      </h3>
      <p className="font-secondary text-[14px] leading-[1.55] text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
}
