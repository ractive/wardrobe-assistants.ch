"use client";

import { Calendar, Home, type LucideIcon, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
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
          Composition choice: two separate triggers side-by-side.
          UserMenu occupies the full-width slot (email label + sign-out dropdown).
          ThemeToggle sits as a compact icon button below the user menu, visible
          even in icon-collapsed state. This keeps the theme affordance always
          reachable without adding a sub-menu level inside the user dropdown,
          which would be an extra click for a common action.
        */}
        <UserMenu email={userEmail} />
        <div className="flex justify-center px-2 pb-1">
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Re-export icon constants so the layout can pass them to NavLink without
// importing lucide directly.
export { Calendar, Users };
