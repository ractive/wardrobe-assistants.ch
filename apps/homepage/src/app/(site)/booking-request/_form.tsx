"use client";

// iter-26: customer-facing booking-request form. JS-required (the token + the
// time-check both depend on it). Spam defenses are layered:
//   - honeypot input (`website`), visually hidden + aria-hidden
//   - time-check: server rejects submissions made within 2s of mount
//   - JS-injected token: hidden input populated client-side on mount
// Submission posts JSON cross-origin to the admin app.

import { useEffect, useId, useMemo, useState } from "react";
import { contactEmail } from "@/app/site-config";

export type ServiceEntry = {
  id: string;
  name: string;
  description: string | null;
  priceType: "fixed" | "hourly";
  price: number;
};

type Props = {
  services: ServiceEntry[];
  submitUrl: string;
};

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited";

const TOKEN_VALUE = "wa-booking-v1";

// Lowercase + strip diacritics. Used to compare venueCity against "zurich"
// for the call-out-fee hint without tripping on "Zürich" vs "zurich".
function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatPrice(svc: ServiceEntry): string {
  const chf = `CHF ${svc.price.toLocaleString("en-CH")}.-`;
  return svc.priceType === "hourly" ? `${chf} / hour` : chf;
}

export function BookingRequestForm({ services, submitUrl }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationHours, setDurationHours] = useState<number>(5);
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [comment, setComment] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Spam-defense state captured on mount.
  const [formLoadedAt, setFormLoadedAt] = useState<number>(0);
  const [token, setToken] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const formId = useId();

  useEffect(() => {
    setFormLoadedAt(Date.now());
    setToken(TOKEN_VALUE);
  }, []);

  const selectedSelections = useMemo(
    () =>
      services
        .map((s) => ({ serviceId: s.id, quantity: quantities[s.id] ?? 0 }))
        .filter((s) => s.quantity > 0),
    [services, quantities],
  );

  const showCallOutNotice =
    venueCity.trim() !== "" && normalize(venueCity) !== "zurich";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    if (selectedSelections.length === 0) {
      setErrorMessage(
        "Please choose at least one service (set a quantity above zero).",
      );
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          date,
          startTime,
          durationHours,
          venueName,
          venueCity,
          comment: comment || undefined,
          serviceSelections: selectedSelections,
          formLoadedAt,
          honeypot,
          token,
        }),
      });
      if (res.ok) {
        setStatus("success");
        return;
      }
      if (res.status === 429) {
        setStatus("rate_limited");
        return;
      }
      setStatus("error");
      setErrorMessage(
        "We couldn't submit your request right now. Please try again or email us.",
      );
    } catch {
      setStatus("error");
      setErrorMessage(
        "We couldn't reach the server. Please try again or email us.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-[16px] border border-[var(--border)] bg-[var(--accent)]/60 p-8"
        role="status"
        aria-live="polite"
      >
        <h2 className="font-primary text-[22px] font-bold text-[var(--foreground)]">
          Request received — thank you.
        </h2>
        <p className="mt-3 font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)]">
          We've sent a confirmation email to{" "}
          <strong className="text-[var(--foreground)]">{customerEmail}</strong>.
          Someone from the team will be in touch with a tailored offer shortly.
        </p>
        <dl className="mt-5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-secondary text-[14px]">
          <dt className="text-[var(--muted-foreground)]">When</dt>
          <dd>
            {date} at {startTime} ({durationHours}h)
          </dd>
          <dt className="text-[var(--muted-foreground)]">Where</dt>
          <dd>
            {venueName}, {venueCity}
          </dd>
        </dl>
        <button
          type="button"
          onClick={() => {
            setCustomerName("");
            setCustomerEmail("");
            setCustomerPhone("");
            setDate("");
            setStartTime("");
            setDurationHours(5);
            setVenueName("");
            setVenueCity("");
            setComment("");
            setQuantities({});
            setStatus("idle");
          }}
          className="mt-6 inline-flex items-center justify-center rounded-[10px] border border-[var(--border)] px-4 py-2 font-primary text-[14px] text-[var(--foreground)] hover:bg-[var(--muted)]"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-6"
      aria-describedby={`${formId}-help`}
    >
      <p
        id={`${formId}-help`}
        className="font-secondary text-[14px] text-[var(--muted-foreground)]"
      >
        All fields are required unless marked optional. We'll reply by email
        with a tailored offer.
      </p>

      {/* Honeypot — visually hidden but present in the DOM. Bots that auto-
         fill all inputs will set this and trip the server. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor={`${formId}-website`}>
          Leave this field blank
          <input
            type="text"
            id={`${formId}-website`}
            name="website"
            autoComplete="off"
            tabIndex={-1}
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-primary text-[16px] font-bold text-[var(--foreground)]">
          Your contact details
        </legend>
        <Field
          label="Your name"
          id={`${formId}-customer-name`}
          value={customerName}
          onChange={setCustomerName}
          required
          autoComplete="name"
        />
        <Field
          label="Email"
          id={`${formId}-customer-email`}
          value={customerEmail}
          onChange={setCustomerEmail}
          required
          type="email"
          autoComplete="email"
        />
        <Field
          label="Phone"
          id={`${formId}-customer-phone`}
          value={customerPhone}
          onChange={setCustomerPhone}
          required
          autoComplete="tel"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-primary text-[16px] font-bold text-[var(--foreground)]">
          When and where
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Date"
            id={`${formId}-date`}
            value={date}
            onChange={setDate}
            required
            type="date"
          />
          <Field
            label="Start time"
            id={`${formId}-start-time`}
            value={startTime}
            onChange={setStartTime}
            required
            type="time"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${formId}-duration`}
            className="font-primary text-[14px] font-medium text-[var(--foreground)]"
          >
            Duration (hours)
          </label>
          <input
            id={`${formId}-duration`}
            type="number"
            min={5}
            max={24}
            step={1}
            value={durationHours}
            required
            onChange={(e) => {
              const n = Number(e.target.value);
              setDurationHours(Number.isFinite(n) ? n : 5);
            }}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-secondary text-[15px]"
          />
        </div>
        <Field
          label="Venue name"
          id={`${formId}-venue-name`}
          value={venueName}
          onChange={setVenueName}
          required
        />
        <Field
          label="City"
          id={`${formId}-venue-city`}
          value={venueCity}
          onChange={setVenueCity}
          required
        />
        {showCallOutNotice && (
          <p className="rounded-[10px] border border-[var(--border)] bg-[var(--accent)]/40 p-3 font-secondary text-[13px] leading-[1.55] text-[var(--muted-foreground)]">
            Locations outside Zurich incur a call-out fee, which will be
            included in your offer.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-primary text-[16px] font-bold text-[var(--foreground)]">
          Services
        </legend>
        {services.length === 0 ? (
          <p className="font-secondary text-[14px] text-[var(--muted-foreground)]">
            The service catalog isn't available right now — please email{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="underline underline-offset-4"
            >
              {contactEmail}
            </a>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {services.map((svc) => {
              const inputId = `${formId}-svc-${svc.id}`;
              return (
                <li
                  key={svc.id}
                  className="flex flex-col gap-2 rounded-[12px] border border-[var(--border)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-primary text-[15px] font-medium text-[var(--foreground)]">
                      {svc.name}
                    </span>
                    {svc.description && (
                      <span className="font-secondary text-[13px] text-[var(--muted-foreground)]">
                        {svc.description}
                      </span>
                    )}
                    <span className="font-secondary text-[12px] text-[var(--muted-foreground)]">
                      {formatPrice(svc)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={inputId}
                      className="font-secondary text-[13px] text-[var(--muted-foreground)]"
                    >
                      Number of items / people
                    </label>
                    <input
                      id={inputId}
                      type="number"
                      min={0}
                      step={1}
                      value={quantities[svc.id] ?? 0}
                      onChange={(e) => {
                        const n = Math.max(
                          0,
                          Math.floor(Number(e.target.value)),
                        );
                        setQuantities((q) => ({ ...q, [svc.id]: n }));
                      }}
                      className="w-20 rounded-[8px] border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-secondary text-[14px]"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="rounded-[10px] border border-[var(--border)] bg-[var(--accent)]/40 p-3 font-secondary text-[13px] leading-[1.55] text-[var(--muted-foreground)]">
          Breaks and dinner breaks are coordinated based on the duration of
          duty. Minimum time of duty is 5 hours. Prices shown are guides — the
          final price is in the offer and call-out fees may apply.
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <label
          htmlFor={`${formId}-comment`}
          className="font-primary text-[14px] font-medium text-[var(--foreground)]"
        >
          Anything else?{" "}
          <span className="text-[var(--muted-foreground)]">(optional)</span>
        </label>
        <textarea
          id={`${formId}-comment`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-secondary text-[15px]"
        />
      </fieldset>

      {status === "error" && errorMessage && (
        <p
          role="alert"
          className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-3 font-secondary text-[14px] text-[var(--foreground)]"
        >
          {errorMessage}
        </p>
      )}
      {status === "rate_limited" && (
        <p
          role="alert"
          className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-3 font-secondary text-[14px] text-[var(--foreground)]"
        >
          Too many requests, please try again later. You can also email{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="underline underline-offset-4"
          >
            {contactEmail}
          </a>
          .
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center rounded-[10px] bg-[var(--foreground)] px-5 py-3 font-primary text-[15px] font-medium text-[var(--background)] disabled:opacity-60"
        >
          {status === "submitting" ? "Sending…" : "Request a booking"}
        </button>
        <p className="font-secondary text-[13px] text-[var(--muted-foreground)]">
          Trouble submitting? Email{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="underline underline-offset-4"
          >
            {contactEmail}
          </a>
          .
        </p>
      </div>
    </form>
  );
}

function Field(props: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={props.id}
        className="font-primary text-[14px] font-medium text-[var(--foreground)]"
      >
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type ?? "text"}
        value={props.value}
        required={props.required}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-secondary text-[15px]"
      />
    </div>
  );
}
