"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingSelectionItem } from "../schema";
import {
  addBookingSelection,
  deleteBookingSelection,
  updateBookingSelectionQuantity,
} from "../server/actions";

// Minimal shape of a service needed here. Passed in from the server component
// (page.tsx) to avoid importing from features/services — cross-feature rule.
export interface ServiceOption {
  id: string;
  name: string;
  priceType: "fixed" | "hourly";
  price: number;
  priceFormatted: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSubtotal(
  selections: BookingSelectionItem[],
  durationHours: number | null,
): string {
  let total = 0;
  for (const s of selections) {
    if (s.priceType === "hourly") {
      total += s.unitPrice * s.quantity * (durationHours ?? 0);
    } else {
      total += s.unitPrice * s.quantity;
    }
  }
  return `CHF ${total}.-`;
}

function formatLineAmount(
  item: BookingSelectionItem,
  durationHours: number | null,
): string {
  if (item.priceType === "hourly") {
    if (durationHours === null) return "—";
    return `CHF ${item.unitPrice * item.quantity * durationHours}.-`;
  }
  return `CHF ${item.unitPrice * item.quantity}.-`;
}

// ---------------------------------------------------------------------------
// Add-service popover
// ---------------------------------------------------------------------------

function AddServicePopover({
  services,
  onAdd,
  disabled,
}: {
  services: ServiceOption[];
  onAdd: (serviceId: string, quantity: number) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);

  function handleAdd() {
    if (!selectedServiceId) return;
    onAdd(selectedServiceId, quantity);
    // Reset for next use
    setSelectedServiceId(services[0]?.id ?? "");
    setQuantity(1);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || services.length === 0}
        >
          + Add service
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Add a service</p>
          <div className="space-y-2">
            <label
              htmlFor="add-service-select"
              className="text-xs text-[var(--muted-foreground)]"
            >
              Service
            </label>
            <Select
              value={selectedServiceId}
              onValueChange={setSelectedServiceId}
            >
              <SelectTrigger id="add-service-select" className="w-full">
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.priceFormatted}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="add-service-qty"
              className="text-xs text-[var(--muted-foreground)]"
            >
              Quantity
            </label>
            <Input
              id="add-service-qty"
              type="number"
              min={1}
              max={10000}
              value={quantity}
              onChange={(e) => {
                const n = Number(e.target.value);
                setQuantity(Number.isFinite(n) ? Math.max(1, n) : 1);
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={handleAdd}
            disabled={!selectedServiceId}
          >
            Add
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Single editable line-item row (autosave on blur with 500 ms debounce)
// ---------------------------------------------------------------------------

function LineItemRow({
  bookingId,
  item,
  durationHours,
  onDeleted,
  onQuantityChanged,
}: {
  bookingId: string;
  item: BookingSelectionItem;
  durationHours: number | null;
  onDeleted: (selectionId: string) => void;
  onQuantityChanged: (selectionId: string, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const [isDeleting, startDeleteTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last successfully saved value to avoid redundant saves.
  const savedQuantityRef = useRef(item.quantity);

  // Keep local quantity in sync if the parent re-fetches and passes new item.
  useEffect(() => {
    setQuantity(item.quantity);
    savedQuantityRef.current = item.quantity;
  }, [item.quantity]);

  const saveQuantity = useCallback(
    (newQty: number) => {
      if (newQty === savedQuantityRef.current) return;
      savedQuantityRef.current = newQty;
      // Fire-and-forget — failure shows a toast, success is silent.
      updateBookingSelectionQuantity({
        bookingId,
        selectionId: item.id,
        quantity: newQty,
      })
        .then((result) => {
          if (result.error) {
            toast.error(result.message);
            // Roll back the optimistic ref so the next blur retries.
            savedQuantityRef.current = item.quantity;
            return;
          }
          onQuantityChanged(item.id, newQty);
        })
        .catch(() => {
          toast.error("Could not update quantity.");
          savedQuantityRef.current = item.quantity;
        });
    },
    [bookingId, item.id, item.quantity, onQuantityChanged],
  );

  // Cancel any pending debounced save on unmount so we don't fire a save
  // after the component has been torn down.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQuantityChange(value: number) {
    setQuantity(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveQuantity(value);
    }, 500);
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        const result = await deleteBookingSelection({
          bookingId,
          selectionId: item.id,
        });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        onDeleted(item.id);
      } catch {
        toast.error("Could not remove line item.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex-1 text-sm ${item.serviceArchived ? "line-through opacity-60" : ""}`}
      >
        {item.serviceName}
        {item.priceType === "hourly" && (
          <span className="ml-1 text-[var(--muted-foreground)] text-xs">
            /hr
          </span>
        )}
      </span>
      {/* Amount — md+ only, left-aligned, immediately after description */}
      <span className="hidden md:inline-block w-28 text-left text-sm tabular-nums text-[var(--muted-foreground)]">
        {formatLineAmount(item, durationHours)}
      </span>
      <Input
        type="number"
        min={1}
        max={10000}
        className="w-20"
        aria-label={`Quantity for ${item.serviceName}`}
        value={quantity}
        onChange={(e) => {
          const n = Number(e.target.value);
          handleQuantityChange(Number.isFinite(n) ? Math.max(1, n) : 1);
        }}
        disabled={isDeleting}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Remove ${item.serviceName}`}
        onClick={handleDelete}
        disabled={isDeleting}
      >
        &times;
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export function LineItemsEditor({
  bookingId,
  initialSelections,
  services,
  durationHours,
}: {
  bookingId: string;
  initialSelections: BookingSelectionItem[];
  services: ServiceOption[];
  durationHours: number | null;
}) {
  const [selections, setSelections] =
    useState<BookingSelectionItem[]>(initialSelections);
  const [isAdding, startAddTransition] = useTransition();

  function handleAdd(serviceId: string, quantity: number) {
    startAddTransition(async () => {
      try {
        const result = await addBookingSelection({
          bookingId,
          serviceId,
          quantity,
        });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        // result carries the new selection row
        if (result.selection) {
          setSelections((prev) => [...prev, result.selection]);
        }
      } catch {
        toast.error("Could not add service.");
      }
    });
  }

  function handleDeleted(selectionId: string) {
    setSelections((prev) => prev.filter((s) => s.id !== selectionId));
  }

  function handleQuantityChanged(selectionId: string, quantity: number) {
    setSelections((prev) =>
      prev.map((s) => (s.id === selectionId ? { ...s, quantity } : s)),
    );
  }

  const hasHourly = selections.some((s) => s.priceType === "hourly");

  return (
    <div className="space-y-3">
      {selections.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No line items yet.
        </p>
      ) : (
        <div className="space-y-2">
          {selections.map((item) => (
            <LineItemRow
              key={item.id}
              bookingId={bookingId}
              item={item}
              durationHours={durationHours}
              onDeleted={handleDeleted}
              onQuantityChanged={handleQuantityChanged}
            />
          ))}
        </div>
      )}

      <AddServicePopover
        services={services}
        onAdd={handleAdd}
        disabled={isAdding}
      />

      {selections.length > 0 && (
        <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
          <span className="font-medium tabular-nums">
            Estimated total: {formatSubtotal(selections, durationHours)}
          </span>
          {hasHourly && durationHours === null && (
            <span className="ml-2 text-[var(--muted-foreground)]">
              (hourly services require duration to be set)
            </span>
          )}
          <span className="ml-2 text-[var(--muted-foreground)]">
            — locked at offer send
          </span>
        </div>
      )}
    </div>
  );
}

// Read-only display when booking is past the 'created' status
export function LineItemsReadOnly({
  selections,
  durationHours,
}: {
  selections: BookingSelectionItem[];
  durationHours: number | null;
}) {
  if (selections.length === 0) return null;

  const total = selections.reduce((sum, s) => {
    if (s.priceType === "hourly") {
      return sum + s.unitPrice * s.quantity * (durationHours ?? 0);
    }
    return sum + s.unitPrice * s.quantity;
  }, 0);

  return (
    <div className="space-y-1 text-sm">
      <ul className="space-y-1">
        {selections.map((s) => (
          <li key={s.id} className="flex items-center gap-4">
            <span
              className={`flex-1 ${s.serviceArchived ? "line-through opacity-60" : ""}`}
            >
              {s.serviceName}
              {s.priceType === "hourly" && (
                <span className="ml-1 text-[var(--muted-foreground)] text-xs">
                  /hr
                </span>
              )}
            </span>
            {/* Amount — md+ only, left-aligned, immediately after description */}
            <span className="hidden md:inline-block w-28 text-left tabular-nums text-[var(--muted-foreground)]">
              {formatLineAmount(s, durationHours)}
            </span>
            {/* tabular-nums keeps digit columns aligned when scanning multiple rows */}
            <span className="tabular-nums text-[var(--muted-foreground)]">
              &times;{s.quantity}
            </span>
          </li>
        ))}
      </ul>
      {/* Total row — right-aligned to anchor the column visually as a footer */}
      <div className="mt-2 flex justify-end border-t border-[var(--border)] pt-1">
        <span className="tabular-nums font-medium">Total: CHF {total}.-</span>
      </div>
    </div>
  );
}
