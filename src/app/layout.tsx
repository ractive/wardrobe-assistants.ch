import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Wardrobe Assistants — Backstage Wardrobe Crews for Switzerland",
	description:
		"Professional tour wardrobe assistants serving theatres, concerts and festivals across Switzerland. Quick changes, ironing, repairs, laundry and more.",
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
