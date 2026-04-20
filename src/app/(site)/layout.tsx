import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function SiteLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<div className="relative flex min-h-full flex-col bg-[var(--background)]">
			<div
				className="pointer-events-none fixed inset-0 bg-[url('/background.webp')] bg-[length:210%] bg-[center_top] bg-no-repeat opacity-35 md:bg-[length:150%] lg:bg-cover lg:bg-[center_top_-50px] [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]"
				aria-hidden="true"
			/>
			<Nav />
			<main className="relative flex-1">{children}</main>
			<Footer />
		</div>
	);
}
