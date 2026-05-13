import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ZodClientInit } from "@/components/ZodClientInit";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wardrobe Assistants — Admin",
  // Admin must never appear in search engines.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Forward the proxy's per-request nonce (proxy.ts) to next-themes so its
  // anti-FOUC inline script carries a nonce that matches `script-src`.
  // Without this the script is blocked by `strict-dynamic` + nonce CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ZodClientInit />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
