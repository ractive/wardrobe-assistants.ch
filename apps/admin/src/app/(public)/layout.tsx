import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-[var(--border)] border-b px-4 py-4">
        <span className="font-semibold text-sm">Wardrobe Assistants</span>
      </header>
      <main className="px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
