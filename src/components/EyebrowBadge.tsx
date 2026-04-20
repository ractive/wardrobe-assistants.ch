export function EyebrowBadge({
	label,
	size = "sm",
}: { label: string; size?: "sm" | "md" }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-2">
			<svg
				className="h-4 w-4"
				viewBox="0 0 16 16"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M9.187 1.896l-2.81 6.376-6.377 2.811 6.377 2.811 2.81 6.378 2.812-6.377 6.376-2.811-6.376-2.811-2.812-6.377z"
					stroke="var(--color-info-foreground)"
					strokeWidth="1"
					transform="translate(1.876, 1.896) scale(0.75)"
				/>
			</svg>
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
