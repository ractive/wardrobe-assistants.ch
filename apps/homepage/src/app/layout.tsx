import type { Metadata } from "next";
import "./globals.css";
import {
  contactEmail,
  defaultTitle,
  description,
  siteName,
  siteUrl,
} from "./site-config";

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

const professionalServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: siteName,
  description,
  url: siteUrl,
  email: contactEmail,
  image: `${siteUrl}/og-image.png`,
  areaServed: {
    "@type": "Country",
    name: "Switzerland",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Zürich",
    addressCountry: "CH",
  },
  serviceType: [
    "Backstage wardrobe crew",
    "Tour dressing",
    "Costume repairs",
    "Quick changes",
    "Theatre wardrobe support",
  ],
  priceRange: "$$",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <head>
        <link
          rel="preload"
          as="image"
          href="/background.webp"
          fetchPriority="high"
        />
        <link
          href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500,700|inter:400,500|geist:400,500&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be inlined as text
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(professionalServiceJsonLd),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-secondary">
        {children}
      </body>
    </html>
  );
}
