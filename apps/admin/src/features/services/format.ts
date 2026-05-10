// Hand-rolled CHF formatter — `Intl.NumberFormat("de-CH", { style: "currency",
// currency: "CHF" })` renders `CHF 25.00`, but Swiss trade convention writes
// whole-CHF prices as `CHF 25.-`. Domain rule: prices are integer CHF, no
// centimes. Reused by every surface that renders a service or event line item.
export function formatChf(price: number, type: "fixed" | "hourly"): string {
  const base = `CHF ${price}.-`;
  return type === "hourly" ? `${base}/h` : base;
}
