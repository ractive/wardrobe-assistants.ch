import Link from "next/link";
import type { ReactNode } from "react";
import { HasPermission } from "@/components/HasPermission";

type Item = {
  href: string;
  label: string;
  perm: Parameters<typeof HasPermission>[0]["perm"];
};

const ITEMS: Item[] = [{ href: "/users", label: "Users", perm: "USER_INVITE" }];

function SidebarLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm hover:bg-[var(--secondary)]"
    >
      {children}
    </Link>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="hidden w-48 shrink-0 border-[var(--border)] border-r px-3 py-6 md:block">
      <nav aria-label="Primary" className="flex flex-col gap-1">
        <SidebarLink href="/">Home</SidebarLink>
        {ITEMS.map((item) => (
          <HasPermission key={item.href} perm={item.perm}>
            <SidebarLink href={item.href}>{item.label}</SidebarLink>
          </HasPermission>
        ))}
      </nav>
    </aside>
  );
}
