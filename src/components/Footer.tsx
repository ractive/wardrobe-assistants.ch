const serviceLinks = ["Quick changes", "Laundry & steam", "Repairs on tour", "Tour management"];
const companyLinks = ["About", "The crew"];
const contactInfo = [
	"hello@wardrobe-assistants.ch",
	"+41 44 123 45 67",
	"Zürich · Basel · Genève",
];

export function Footer() {
	return (
		<footer className="flex flex-col gap-10 bg-[var(--sidebar)] px-[120px] pt-14 pb-8">
			<div className="flex w-full gap-16">
				{/* Brand */}
				<div className="flex flex-col gap-4">
					<div className="flex items-center gap-2.5">
						<span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
						<span className="font-primary text-[14px] font-medium tracking-[2px] text-[#EDEAE4]">
							WARDROBE ASSISTANTS
						</span>
					</div>
					<p className="w-[320px] font-body text-[13px] leading-[1.6] text-[#8F8A83]">
						Backstage wardrobe crews for theatres, concerts and festivals
						across Switzerland.
					</p>
				</div>

				{/* Services */}
				<div className="flex flex-col gap-3.5">
					<span className="font-primary text-[12px] font-medium tracking-[1.5px] text-[var(--muted-foreground)]">
						Services
					</span>
					{serviceLinks.map((link) => (
						<a
							key={link}
							href="#services"
							className="font-body text-[13px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
						>
							{link}
						</a>
					))}
				</div>

				{/* Company */}
				<div className="flex flex-col gap-3.5">
					<span className="font-primary text-[12px] font-medium tracking-[1.5px] text-[var(--muted-foreground)]">
						Company
					</span>
					{companyLinks.map((link) => (
						<a
							key={link}
							href="#about"
							className="font-body text-[13px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
						>
							{link}
						</a>
					))}
				</div>

				{/* Contact */}
				<div className="flex flex-col gap-3.5">
					<span className="font-primary text-[12px] font-medium tracking-[1.5px] text-[var(--muted-foreground)]">
						Contact
					</span>
					{contactInfo.map((info) => (
						<span
							key={info}
							className="font-body text-[13px] text-[var(--muted-foreground)]"
						>
							{info}
						</span>
					))}
				</div>
			</div>

			{/* Divider */}
			<div className="h-px w-full bg-[var(--secondary)]" />

			{/* Bottom */}
			<div className="flex w-full items-center justify-between">
				<span className="font-body text-[12px] text-[#6E6962]">
					© 2026 wardrobe-assistants.ch
				</span>
				<div className="flex gap-5">
					{["Privacy", "Terms", "Imprint"].map((item) => (
						<a
							key={item}
							href="#"
							className="font-body text-[12px] text-[#8F8A83] transition-colors hover:text-[var(--foreground)]"
						>
							{item}
						</a>
					))}
				</div>
			</div>
		</footer>
	);
}
