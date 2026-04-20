"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
	{ label: "Services", href: "#services" },
	{ label: "Testimonials", href: "#testimonials" },
	{ label: "Contact", href: "#contact" },
];

export function Nav() {
	const [open, setOpen] = useState(false);

	return (
		<nav className="relative flex w-full items-center justify-between border-b border-[var(--secondary)] px-6 py-5 lg:px-14">
			<Link
				href="/"
				className="font-primary text-[14px] font-bold tracking-[2px] text-[var(--foreground)]"
			>
				WARDROBE ASSISTANTS
			</Link>

			{/* Desktop links */}
			<div className="hidden items-center gap-8 md:flex">
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

			{/* Mobile toggle */}
			<button
				type="button"
				className="md:hidden text-[var(--foreground)]"
				onClick={() => setOpen(!open)}
				aria-label={open ? "Close menu" : "Open menu"}
			>
				{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
			</button>

			{/* Mobile menu */}
			{open && (
				<div className="absolute top-full left-0 z-50 flex w-full flex-col gap-4 border-b border-[var(--secondary)] bg-[var(--background)] px-6 py-6 md:hidden">
					{links.map((link) => (
						<a
							key={link.href}
							href={link.href}
							onClick={() => setOpen(false)}
							className="font-secondary text-[16px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
						>
							{link.label}
						</a>
					))}
				</div>
			)}
		</nav>
	);
}
