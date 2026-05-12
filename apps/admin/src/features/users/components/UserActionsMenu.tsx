"use client";

import { Mail, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11"
                aria-label={`Message ${user.displayName}`}
                onClick={() => setMessageOpen(true)}
              >
                <Mail aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Message user</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={isSelf ? 0 : -1} className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11"
                  aria-label={`Delete ${user.displayName}`}
                  aria-disabled={isSelf}
                  onClick={() => {
                    if (isSelf) return;
                    setDeleteOpen(true);
                  }}
                  data-disabled={isSelf ? "" : undefined}
                  style={
                    isSelf ? { pointerEvents: "none", opacity: 0.5 } : undefined
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isSelf ? "Cannot delete your own account" : "Delete user"}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

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
