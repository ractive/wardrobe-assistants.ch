export function Footer() {
	return (
		<footer className="flex flex-col gap-10 px-6 pt-14 pb-8 md:px-10 lg:px-[120px]">
			<div className="flex w-full flex-col gap-10 md:flex-row md:items-start md:justify-between">
				{/* Brand */}
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-2.5">
						<span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
						<span className="font-primary text-[14px] font-medium tracking-[2px] text-[#EDEAE4]">
							WARDROBE ASSISTANTS
						</span>
					</div>
					<p className="max-w-[320px] font-body text-[13px] leading-[1.6] text-[#8F8A83]">
						Backstage wardrobe squad for theatres, concerts and festivals
						across Switzerland.
					</p>
				</div>

				{/* Contact */}
				<div className="flex flex-col gap-3.5">
					<span className="font-primary text-[12px] font-medium tracking-[1.5px] text-[var(--muted-foreground)]">
						Contact
					</span>
					<a
						href="mailto:hello@wardrobe-assistants.ch"
						className="font-body text-[13px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
					>
						hello@wardrobe-assistants.ch
					</a>
					<span className="font-body text-[13px] text-[var(--muted-foreground)]">
						Zürich
					</span>
				</div>
			</div>

			{/* Divider */}
			<div className="h-px w-full bg-[var(--secondary)]" />

			{/* Bottom */}
			<div className="flex w-full items-center justify-between">
				<span className="font-body text-[12px] text-[#6E6962]">
					© 2026 wardrobe-assistants.ch
				</span>
			</div>
		</footer>
	);
}
