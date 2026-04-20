import Link from "next/link";

const links = [
	{ label: "Services", href: "#services" },
	{ label: "Testimonials", href: "#testimonials" },
	{ label: "About", href: "#about" },
	{ label: "Contact", href: "#contact" },
];

export function Nav() {
	return (
		<nav className="flex w-full items-center justify-between border-b border-[var(--secondary)] px-14 py-5">
			<Link
				href="/"
				className="font-primary text-[14px] font-bold tracking-[2px] text-[var(--foreground)]"
			>
				WARDROBE ASSISTANTS
			</Link>
			<div className="flex items-center gap-8">
				{links.map((link) => (
					<a
						key={link.href}
						href={link.href}
						className="font-secondary text-[14px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
					>
						{link.label}
					</a>
				))}
			</div>
		</nav>
	);
}
