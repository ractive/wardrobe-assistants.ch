"use client";

import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * (i) icon button with a short hint: shown while a mouse hovers the icon
 * (desktop), and pinned open by a click, tap or Enter/Space (any device).
 *
 * A Radix Tooltip cannot do this: it opens on hover and focus only, so on a
 * touch screen the hint was unreachable. A plain Popover opens on click only.
 *
 * - Mouse hover opens it, leaving closes it unless it was pinned.
 * - Click/tap/Enter toggles the pin; while hover-opened, the click pins it
 *   instead of closing it.
 * - Escape or a click outside closes it.
 * - Focus stays on the icon: the hint is plain text, nothing to tab into.
 */
export function InfoHint({
  label,
  children,
  side = "top",
  triggerClassName,
  iconClassName = "size-3.5",
  contentClassName,
}: {
  /** Accessible name of the icon button, e.g. "Info: Send offer". */
  label: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  triggerClassName?: string;
  iconClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPinned(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={triggerClassName}
          onClick={(event) => {
            // Handle the toggle here, not in Radix: a click on a
            // hover-opened hint pins it instead of closing it.
            event.preventDefault();
            const next = !pinned;
            setPinned(next);
            setOpen(next);
          }}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && !pinned) setOpen(false);
          }}
        >
          <Info aria-hidden="true" className={iconClassName} />
        </button>
      </PopoverTrigger>
      {/* Radix renders the content as role="dialog", which needs a name. */}
      <PopoverContent
        aria-label={label}
        side={side}
        className={cn("max-w-xs", contentClassName)}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
