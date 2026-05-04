import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://wardrobe-assistants.ch";
const siteName = "Wardrobe Assistants";
const defaultTitle = "Wardrobe Assistants — Backstage Crews in Switzerland";
const description =
	"Professional tour wardrobe assistants for theatres, concerts and festivals across Switzerland. Quick changes, ironing, repairs, laundry and load-in support.";

export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: defaultTitle,
		template: "%s | Wardrobe Assistants",
	},
	description,
	alternates: {
		canonical: "/",
	},
	openGraph: {
		type: "website",
		url: "/",
		siteName,
		title: defaultTitle,
		description,
		locale: "en_CH",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Wardrobe Assistants — backstage wardrobe crews in Switzerland",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: defaultTitle,
		description,
		images: ["/og-image.png"],
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="h-full antialiased">
			<head>
				<link
					href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500,700|inter:400,500|geist:400,500"
					rel="stylesheet"
				/>
			</head>
			<body className="min-h-full flex flex-col font-secondary">
				{children}
			</body>
		</html>
	);
}
