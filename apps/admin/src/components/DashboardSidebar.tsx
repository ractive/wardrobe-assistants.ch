"use client";

import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Home,
  type LucideIcon,
  Tag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/UserMenu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

// NavLink with icon support and tooltip for icon-collapsed state.
export function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const active =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={() => {
            if (isMobile) setOpenMobile(false);
          }}
        >
          <Icon aria-hidden="true" className="size-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface DashboardSidebarProps {
  // Permission-gated NavLinks rendered as children by the layout.
  children: ReactNode;
  userEmail: string;
}

export function DashboardSidebar({
  children,
  userEmail,
}: DashboardSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Ungrouped home link sits above the "Manage" group. */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavLink href="/" label="Home" icon={Home} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* "Manage" group — children are HasPermission-gated NavLinks from layout. */}
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{children}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/*
          Theme toggle moved inside UserMenu as a DropdownMenuSub (D.1).
          This compacts the sidebar footer to a single user menu trigger.
        */}
        <UserMenu email={userEmail} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Re-export icon constants so the layout can pass them to NavLink without
// importing lucide directly.
export { Calendar, CalendarCheck, CalendarPlus, Tag, Users };
