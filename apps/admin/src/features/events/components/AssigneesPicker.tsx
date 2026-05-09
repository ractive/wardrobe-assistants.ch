"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AssignableUser, EventAssignee } from "../schema";
import { assignUser, unassignUser } from "../server/actions";

export function AssigneesPicker({
  eventId,
  assignees,
  candidates,
}: {
  eventId: string;
  assignees: EventAssignee[];
  candidates: AssignableUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const assigneeIds = new Set(assignees.map((a) => a.userId));
  const unassigned = candidates.filter((c) => !assigneeIds.has(c.id));

  function onPick(userId: string) {
    setOpen(false);
    startTransition(async () => {
      try {
        const result = await assignUser({ eventId, userId });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not assign.");
      }
    });
  }

  function onRemove(userId: string) {
    startTransition(async () => {
      try {
        const result = await unassignUser({ eventId, userId });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not unassign.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {assignees.length === 0 ? (
          <span className="text-[var(--muted-foreground)] text-sm">
            No one assigned yet.
          </span>
        ) : (
          assignees.map((a) => (
            <Badge
              key={a.userId}
              variant="secondary"
              className="flex items-center gap-1.5 pr-1"
            >
              <span>{a.displayName}</span>
              <button
                type="button"
                aria-label={`Unassign ${a.displayName}`}
                onClick={() => onRemove(a.userId)}
                disabled={isPending}
                className="rounded-full p-0.5 hover:bg-[var(--muted)]"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || unassigned.length === 0}
            className="self-start"
          >
            {unassigned.length === 0 ? "Everyone assigned" : "Assign user"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search users…" />
            <CommandList>
              <CommandEmpty>No matching users.</CommandEmpty>
              <CommandGroup>
                {unassigned.map((u) => (
                  <CommandItem
                    key={u.id}
                    value={`${u.displayName} ${u.email}`}
                    onSelect={() => onPick(u.id)}
                  >
                    <div className="flex flex-col">
                      <span>{u.displayName}</span>
                      <span className="text-[var(--muted-foreground)] text-xs">
                        {u.email}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
