"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BookingSelectionItem } from "../schema";
import { replaceBookingSelections } from "../server/actions";

// Minimal shape of a service needed here. Passed in from the server component
// (page.tsx) to avoid importing from features/services — cross-feature rule.
export interface ServiceOption {
  id: string;
  name: string;
  priceType: "fixed" | "hourly";
  price: number;
  priceFormatted: string;
}

interface LineRow {
  serviceId: string;
  quantity: number;
}

function formatSubtotal(
  rows: LineRow[],
  services: ServiceOption[],
  durationHours: number | null,
): string {
  let totalCents = 0;
  for (const row of rows) {
    const svc = services.find((s) => s.id === row.serviceId);
    if (!svc) continue;
    if (svc.priceType === "hourly") {
      totalCents += svc.price * row.quantity * (durationHours ?? 0) * 100;
    } else {
      totalCents += svc.price * row.quantity * 100;
    }
  }
  // price is already in CHF (not cents), so divide back out
  const chf = totalCents / 100;
  return `CHF ${chf}.-`;
}

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
  const router = useRouter();
  const [rows, setRows] = useState<LineRow[]>(
    initialSelections.map((s) => ({
      serviceId: s.serviceId,
      quantity: s.quantity,
    })),
  );
  const [isPending, startTransition] = useTransition();

  function addRow() {
    if (services.length === 0) return;
    setRows((prev) => [
      ...prev,
      { serviceId: services[0]?.id ?? "", quantity: 1 },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateServiceId(index: number, serviceId: string) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, serviceId } : r)),
    );
  }

  function updateQuantity(index: number, quantity: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, quantity } : r)),
    );
  }

  function onSave() {
    startTransition(async () => {
      try {
        const result = await replaceBookingSelections({
          bookingId,
          selections: rows.map((r) => ({
            serviceId: r.serviceId,
            quantity: r.quantity,
          })),
        });
        if (result.error) {
          toast.error(result.message);
          return;
        }
        toast.success(result.message);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save line items.",
        );
      }
    });
  }

  const hasHourly = rows.some((r) => {
    const svc = services.find((s) => s.id === r.serviceId);
    return svc?.priceType === "hourly";
  });

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-[var(--muted-foreground)] text-sm">
          No line items yet.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const svc = services.find((s) => s.id === row.serviceId);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: row order is user-controlled
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={row.serviceId}
                  onValueChange={(v) => updateServiceId(i, v)}
                  disabled={isPending}
                >
                  <SelectTrigger className="flex-1">
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
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  className="w-20"
                  aria-label={`Quantity for ${svc?.name ?? "service"}`}
                  value={row.quantity}
                  onChange={(e) =>
                    updateQuantity(i, Math.max(1, Number(e.target.value)))
                  }
                  disabled={isPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove line item"
                  onClick={() => removeRow(i)}
                  disabled={isPending}
                >
                  &times;
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={isPending || services.length === 0}
        >
          Add service
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save line items"}
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="rounded-md bg-[var(--muted)] px-3 py-2 text-sm">
          <span className="font-medium">
            Estimated total: {formatSubtotal(rows, services, durationHours)}
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
}: {
  selections: BookingSelectionItem[];
}) {
  if (selections.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm">
      {selections.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-4">
          <span className={s.serviceArchived ? "line-through opacity-60" : ""}>
            {s.serviceName}
          </span>
          <span className="text-[var(--muted-foreground)]">
            &times;{s.quantity}
          </span>
        </li>
      ))}
    </ul>
  );
}
