import type { ComponentProps } from "react";

type ButtonVariant = "primary" | "outline";

type ButtonProps = ComponentProps<"a"> & {
	variant?: ButtonVariant;
};

export function Button({
	variant = "primary",
	className,
	children,
	...props
}: ButtonProps) {
	const base =
		"inline-flex h-12 items-center justify-center gap-1.5 rounded-full px-6 py-3 font-primary text-[14px] font-medium text-center transition-opacity hover:opacity-90";

	const variants: Record<ButtonVariant, string> = {
		primary:
			"bg-[var(--primary)] text-[var(--primary-foreground)]",
		outline:
			"border border-[var(--border)] text-[var(--muted-foreground)] shadow-[0_1px_1.75px_rgba(0,0,0,0.05)]",
	};

	return (
		<a
			className={`${base} ${variants[variant]} ${className ?? ""}`}
			{...props}
		>
			{children}
		</a>
	);
}
