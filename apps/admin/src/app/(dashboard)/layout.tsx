import { redirect } from "next/navigation";
import {
  Calendar,
  DashboardSidebar,
  NavLink,
  Tag,
  Users,
} from "@/components/DashboardSidebar";
import { HasPermission } from "@/components/HasPermission";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getCachedSession } from "@/lib/auth";

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
  return (
    <SidebarProvider>
      <DashboardSidebar userEmail={session.user.email}>
        <HasPermission perm="USER_INVITE">
          <NavLink href="/users" label="Users" icon={Users} />
        </HasPermission>
        <HasPermission perm="EVENT_VIEW">
          <NavLink href="/events" label="Events" icon={Calendar} />
        </HasPermission>
        <HasPermission perm="SERVICE_CREATE">
          <NavLink href="/services" label="Services" icon={Tag} />
        </HasPermission>
      </DashboardSidebar>
      <SidebarInset>
        <header className="flex items-center gap-3 border-[var(--border)] border-b px-4 py-3 md:px-6 md:py-4">
          <SidebarTrigger />
          <span className="font-semibold text-sm md:text-base">
            Wardrobe Assistants — Admin
          </span>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
