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
  // Sidebar is role-gated (not permission-gated) so admins don't see the
  // squad-member shortcuts and squad members don't see admin sections —
  // ADMIN holds every permission, so a permission gate would show both sets.
  const role = await roleForUserId(session.user.id);
  const isAdmin = role === "ADMIN";
  const isSquadMember = role === "SQUAD_MEMBER";
  return (
    <SidebarProvider>
      <DashboardSidebar userEmail={session.user.email}>
        {isAdmin && (
          <>
            <NavLink href="/users" label="Users" icon={Users} />
            <NavLink href="/events" label="Events" icon={Calendar} />
            <NavLink href="/services" label="Services" icon={Tag} />
          </>
        )}
        {isSquadMember && (
          <>
            <NavLink href="/my-events" label="My Events" icon={CalendarCheck} />
            <NavLink
              href="/upcoming-events"
              label="Upcoming Events"
              icon={CalendarPlus}
            />
          </>
        )}
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
