"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserListItem } from "../schema";
import { DeleteUserConfirm } from "./DeleteUserConfirm";
import { MessageUserDialog } from "./MessageUserDialog";

export function UserActionsMenu({
  user,
  isSelf,
}: {
  user: UserListItem;
  isSelf: boolean;
}) {
  const [messageOpen, setMessageOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${user.displayName}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setMessageOpen(true)}>
            Message user
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf}
            onSelect={() => setDeleteOpen(true)}
            className="text-[var(--destructive)] focus:text-[var(--destructive)]"
          >
            {isSelf ? "Delete (self — disabled)" : "Delete user"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MessageUserDialog
        userId={user.id}
        displayName={user.displayName}
        email={user.email}
        open={messageOpen}
        onOpenChange={setMessageOpen}
      />
      <DeleteUserConfirm
        userId={user.id}
        displayName={user.displayName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
