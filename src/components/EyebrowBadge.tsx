export function EyebrowBadge({
	label,
	size = "sm",
}: { label: string; size?: "sm" | "md" }) {
	return (
		<span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2">
			<span
				className={`font-primary tracking-[1.5px] text-[var(--primary)] ${
					size === "md"
						? "text-[14px] font-normal"
						: "text-[12px] font-medium"
				}`}
			>
				{label}
			</span>
		</span>
	);
}
