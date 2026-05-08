import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { InviteUserDialog } from "@/features/users/components/InviteUserDialog";
import { UsersTable } from "@/features/users/components/UsersTable";
import { listUsers } from "@/features/users/server/queries";
import { auth } from "@/lib/auth";
import { userHasPermission } from "@/lib/permissions";

export default async function UsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const allowed = await userHasPermission("USER_INVITE");
  if (!allowed) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-semibold text-3xl">Users</h1>
        <NoPermissionCard />
      </section>
    );
  }

  const users = await listUsers();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-3xl">Users</h1>
          <p className="text-[var(--muted-foreground)]">
            Invite teammates, send messages, and manage access.
          </p>
        </div>
        <InviteUserDialog />
      </header>
      <UsersTable users={users} currentUserId={session.user.id} />
    </section>
  );
}
