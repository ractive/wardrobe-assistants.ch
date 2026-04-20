import type { LucideIcon } from "lucide-react";

interface ServiceCardProps {
	icon: LucideIcon;
	title: string;
	description: string;
}

export function ServiceCard({ icon: Icon, title, description }: ServiceCardProps) {
	return (
		<div className="flex flex-1 flex-col gap-5 rounded-[20px] border border-[var(--border)] bg-[var(--accent)] p-7">
			<div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--secondary)]">
				<Icon className="h-[22px] w-[22px] text-[#B8B3AC]" />
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
