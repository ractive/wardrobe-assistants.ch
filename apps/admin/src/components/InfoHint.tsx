"use client";

import { Info } from "lucide-react";
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// How long a hover-opened hint stays open after the mouse leaves the icon or
// the hint, so the pointer can cross the gap between them (WCAG 1.4.13).
const HOVER_CLOSE_DELAY_MS = 150;

/**
 * (i) icon button with a short hint: shown while a mouse hovers the icon or
 * the hint (desktop), and pinned open by a click, tap or Enter/Space (any
 * device).
 *
 * A Radix Tooltip cannot do this: it opens on hover and focus only, so on a
 * touch screen the hint was unreachable. A plain Popover opens on click only.
 *
 * - Mouse hover opens it; leaving icon and hint closes it unless pinned.
 * - Click/tap/Enter toggles the pin; while hover-opened, the click pins it
 *   instead of closing it.
 * - Escape or a click outside closes it.
 * - Focus stays where it is: the hint is plain text, nothing to tab into,
 *   and closing never moves focus to the icon.
 * - Screen readers get the hint as the icon's description (aria-describedby),
 *   open or not, as they did with the Tooltip.
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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const descriptionId = useId();

  const cancelClose = () => clearTimeout(closeTimer.current);
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const onMouseEnter = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    cancelClose();
    setOpen(true);
  };
  const onMouseLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && !pinned) scheduleClose();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        cancelClose();
        setOpen(next);
        if (!next) setPinned(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-describedby={descriptionId}
          className={triggerClassName}
          onClick={(event) => {
            // Handle the toggle here, not in Radix: a click on a
            // hover-opened hint pins it instead of closing it.
            event.preventDefault();
            cancelClose();
            const next = !pinned;
            setPinned(next);
            setOpen(next);
          }}
          onPointerEnter={onMouseEnter}
          onPointerLeave={onMouseLeave}
        >
          <Info aria-hidden="true" className={iconClassName} />
        </button>
      </PopoverTrigger>
      <span id={descriptionId} className="sr-only">
        {children}
      </span>
      {/* Radix renders the content as role="dialog", which needs a name. */}
      <PopoverContent
        aria-label={label}
        side={side}
        className={cn("max-w-xs", contentClassName)}
        onOpenAutoFocus={(event) => event.preventDefault()}
        // Radix would focus the icon on every close, including a hover
        // close, and take focus away from e.g. an input being typed in.
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={onMouseEnter}
        onPointerLeave={onMouseLeave}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
