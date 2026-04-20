import {
	Shirt,
	Droplets,
	Scissors,
	Crown,
	Truck,
	ClipboardList,
} from "lucide-react";
import { EyebrowBadge } from "@/components/EyebrowBadge";
import { Button } from "@/components/Button";
import { ServiceCard } from "@/components/ServiceCard";

const servicesRow1 = [
	{
		icon: Shirt,
		title: "Quick changes",
		description:
			"Rehearsed dressers stationed at every wing, running timed transitions so performers make their marks without missing a beat.",
	},
	{
		icon: Droplets,
		title: "Ironing & steam",
		description:
			"Wrinkle-free costumes at every call. We iron, press and steam on-site so everything looks sharp under the lights.",
	},
	{
		icon: Scissors,
		title: "Repairs & alterations",
		description:
			"Zips, seams, hems and fittings — handled on-site with a full sewing kit and a steady hand, even minutes before curtain.",
	},
];

const servicesRow2 = [
	{
		icon: Crown,
		title: "Wigs & accessories",
		description:
			"Styled, pinned and tracked by scene. Hats, gloves, jewellery and props accounted for from first rehearsal to final bow.",
	},
	{
		icon: Truck,
		title: "Load-in & load-out",
		description:
			"We help build up and break down — from the first hanger on the rail to the last one packed in the truck.",
	},
	{
		icon: ClipboardList,
		title: "Laundry",
		description:
			"Machine wash, hand wash and stain removal — handled with care so costumes stay fresh and stage-ready night after night.",
	},
];

export default function Home() {
	return (
		<>
			{/* Hero Section */}
			<section className="flex flex-col gap-6 px-6 pt-12 pb-16 md:px-10 lg:gap-7 lg:px-14 lg:pt-[72px] lg:pb-24">
				<EyebrowBadge label="BACKSTAGE" />
				<h1 className="font-primary text-[32px] font-bold leading-[1.05] tracking-[-1px] text-[var(--foreground)] md:text-[40px] lg:text-[48px]">
					Wardrobe Assistants
				</h1>
				<h2 className="font-primary text-[22px] font-bold leading-[1.05] tracking-[-1px] text-[var(--foreground)] md:text-[26px] lg:text-[30px]">
					Steam &amp; Stitch Squad
				</h2>
				<p className="font-primary text-[22px] font-bold leading-[1.05] text-[var(--foreground)] md:text-[26px] lg:text-[30px]">
					Behind every great show, a flawless wardrobe.
				</p>
				<p className="max-w-[520px] font-secondary text-[16px] leading-[1.55] text-[var(--muted-foreground)] lg:text-[17px]">
					We are Switzerland&apos;s professional tour wardrobe assistants —
					serving theatres, concerts and festivals with calm hands and fast
					changes from call to curtain.
				</p>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<Button href="#contact">Book the squad</Button>
					<Button variant="outline" href="#services">
						See services
					</Button>
				</div>
			</section>

			{/* Services Section */}
			<section
				id="services"
				className="flex flex-col items-center gap-10 px-6 pt-16 pb-20 md:px-10 lg:gap-14 lg:px-14 lg:pt-24 lg:pb-[120px]"
			>
				{/* Services Header */}
				<div className="flex flex-col items-center gap-5">
					<EyebrowBadge label="SERVICES" />
					<h2 className="max-w-[900px] text-center font-primary text-[28px] font-bold leading-[1.1] tracking-[-1px] text-[var(--foreground)] md:text-[36px] lg:text-[48px]">
						Everything you need from call to curtain.
					</h2>
					<p className="max-w-[720px] text-center font-secondary text-[15px] leading-[1.6] text-[var(--muted-foreground)] lg:text-[16px]">
						Pre-show prep, quick changes, laundry, repairs, load-in, and
						load-out. We stay with the show so the spotlight stays on the stage
						- not on missing hooks or stuck zips.
					</p>
				</div>

				{/* Services Grid */}
				<div className="grid w-full gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
					{[...servicesRow1, ...servicesRow2].map((service) => (
						<ServiceCard key={service.title} {...service} />
					))}
				</div>
			</section>

			{/* CTA Section */}
			<section
				id="contact"
				className="flex flex-col items-center justify-center px-6 py-16 md:px-10 lg:px-[120px] lg:py-24"
			>
				<div className="flex flex-col items-center gap-6 lg:gap-7">
					<EyebrowBadge label="READY WHEN YOU ARE" size="md" />
					<h2 className="max-w-[900px] text-center font-primary text-[32px] font-medium leading-[1.1] text-[var(--foreground)] md:text-[42px] lg:text-[56px]">
						Ready when the curtain calls.
					</h2>
					<p className="max-w-[680px] text-center font-secondary text-[16px] leading-[1.55] text-[var(--muted-foreground)] lg:text-[17px]">
						Tell us about your tour — dates, cast size, venues — and
						we&apos;ll send a quote within 24 hours.
					</p>
					<p className="max-w-[680px] text-center font-secondary text-[16px] leading-[1.55] text-[var(--muted-foreground)] lg:text-[17px]">
						With over 20 years backstage and many productions under our belts,
						our crew brings the calm confidence that only real experience can.
						From intimate theatre runs to arena-scale touring — we&apos;ve seen
						it all and dressed it all.
					</p>
					<div className="pt-3">
						<Button href="mailto:hello@wardrobe-assistants.ch">
							Request a quote
						</Button>
					</div>
				</div>
			</section>
		</>
	);
}
