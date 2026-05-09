import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserListItem } from "../schema";
import { RoleBadge } from "./RoleBadge";
import { StatusBadge } from "./StatusBadge";
import { UserActionsMenu } from "./UserActionsMenu";

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserListItem[];
  currentUserId: string;
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-8 text-center text-[var(--muted-foreground)]">
        No users yet. Invite your first teammate to get started.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (≤ md) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {users.map((user) => (
          <li
            key={user.id}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-base">
                  {user.displayName}
                </span>
                <span className="font-mono text-[var(--muted-foreground)] text-xs">
                  {user.email}
                </span>
              </div>
              <UserActionsMenu user={user} isSelf={user.id === currentUserId} />
            </div>
            <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-[var(--muted-foreground)]">Role</dt>
              <dd>
                <RoleBadge role={user.role} />
              </dd>
              <dt className="text-[var(--muted-foreground)]">Status</dt>
              <dd>
                <StatusBadge status={user.status} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: table (≥ md) */}
      <div className="hidden rounded-md border border-[var(--border)] md:block">
        <Table aria-label="Users">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.displayName}</TableCell>
                <TableCell className="font-mono text-xs">
                  {user.email}
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.status} />
                </TableCell>
                <TableCell className="text-[var(--muted-foreground)]">
                  {format(user.createdAt, "yyyy-MM-dd")}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <UserActionsMenu
                      user={user}
                      isSelf={user.id === currentUserId}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
