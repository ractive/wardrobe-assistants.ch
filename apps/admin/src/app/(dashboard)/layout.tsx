import { redirect } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  DashboardSidebar,
  NavLink,
  Tag,
  Users,
} from "@/components/DashboardSidebar";
import { InstallPrompt } from "@/components/InstallPrompt";
import { PushSubscribeToggle } from "@/components/PushSubscribeToggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getCachedSession, roleForUserId } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Source of truth for auth: getSession validates the session cookie against
  // the database. The middleware only does a presence check.
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  // Admin-only entries are role-gated (not permission-gated): ADMIN holds
  // every permission, so a permission gate would also show admins the
  // squad-only entries below. The personal "My/Upcoming Bookings" entries
  // are shown to *everyone* — both routes are auth-only and key off the
  // current user's id, so an admin sees only the bookings the system thinks
  // are theirs. iter-39 §B.1.
  const role = await roleForUserId(session.user.id);
  const isAdmin = role === "ADMIN";
  return (
    <SidebarProvider>
      <DashboardSidebar userEmail={session.user.email}>
        {isAdmin && (
          <>
            <NavLink href="/users" label="Users" icon={Users} />
            <NavLink href="/bookings" label="Bookings" icon={Calendar} />
            <NavLink href="/services" label="Services" icon={Tag} />
          </>
        )}
        <NavLink href="/my-bookings" label="My Bookings" icon={CalendarCheck} />
        <NavLink
          href="/upcoming-bookings"
          label="Upcoming Bookings"
          icon={CalendarPlus}
        />
      </DashboardSidebar>
      <SidebarInset>
        <header className="flex items-center gap-3 border-[var(--border)] border-b px-4 py-3 md:px-6 md:py-4">
          <SidebarTrigger />
          <span className="font-semibold text-sm md:text-base">
            Wardrobe Assistants — Admin
          </span>
          <div className="ml-auto">
            <PushSubscribeToggle />
          </div>
        </header>
        <InstallPrompt />
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
