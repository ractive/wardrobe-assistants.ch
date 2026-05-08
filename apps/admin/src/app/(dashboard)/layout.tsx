import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Source of truth for auth: getSession validates the session cookie against
  // the database. The middleware only does a presence check.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen">
      <header className="border-[var(--border)] border-b px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="font-semibold">Wardrobe Assistants — Admin</span>
          <span className="text-[var(--muted-foreground)] text-sm">
            {session.user.email}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      <Toaster />
    </div>
  );
}
