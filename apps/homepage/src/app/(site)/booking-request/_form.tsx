"use client";

// iter-26: customer-facing booking-request form. JS-required (the token + the
// time-check both depend on it). Spam defenses are layered:
//   - honeypot input (`website`), visually hidden + aria-hidden
//   - time-check: server rejects submissions made within 2s of mount
//   - JS-injected token: hidden input populated client-side on mount
// Submission posts JSON cross-origin to the admin app.
//
// iter-31: converted to react-hook-form + zodResolver against the shared
// bookingRequestInputSchema. Per-field validation errors, layout polish,
// duration-input bug fix, empty-catalog-allow via schema refine.

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type BookingRequestInput,
  bookingRequestInputSchema,
} from "@wardrobe-assistants/shared/booking-request-schema";
import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
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
  // Spam-defense state captured on mount — not user-visible fields, stay as
  // plain useState so they're outside the RHF lifecycle.
  const [formLoadedAt, setFormLoadedAt] = useState<number>(0);
  const [token, setToken] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");

  // Service quantities: Record<serviceId, quantity> managed as a single field.
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [status, setStatus] = useState<Status>("idle");
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(
    null,
  );

  // Capture the submission email for the success state copy.
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const [submittedDate, setSubmittedDate] = useState<string>("");
  const [submittedTime, setSubmittedTime] = useState<string>("");
  const [submittedDuration, setSubmittedDuration] = useState<number>(5);
  const [submittedVenueName, setSubmittedVenueName] = useState<string>("");
  const [submittedVenueCity, setSubmittedVenueCity] = useState<string>("");

  const formId = useId();

  useEffect(() => {
    setFormLoadedAt(Date.now());
    setToken(TOKEN_VALUE);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setFocus,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingRequestInput>({
    resolver: zodResolver(bookingRequestInputSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      date: "",
      startTime: "",
      durationHours: 5,
      venueName: "",
      venueCity: "",
      serviceSelections: [],
      comment: "",
    },
  });

  const venueCity = watch("venueCity");
  const showCallOutNotice =
    venueCity.trim() !== "" && normalize(venueCity) !== "zurich";

  async function onValidSubmit(data: BookingRequestInput) {
    setStatus("submitting");
    setServerErrorMessage(null);

    const selectedSelections = services
      .map((s) => ({ serviceId: s.id, quantity: quantities[s.id] ?? 0 }))
      .filter((s) => s.quantity > 0);

    // Inject the computed serviceSelections into the validated data. RHF
    // doesn't track the quantity inputs directly — the schema refine validates
    // them via the serviceSelections field that we populate here.
    const payload: BookingRequestInput = {
      ...data,
      serviceSelections: selectedSelections,
    };

    // Re-run the refine check so if quantities are zero and comment is empty
    // the error shows inline rather than going to the server.
    const refineResult = bookingRequestInputSchema.safeParse(payload);
    if (!refineResult.success) {
      const fieldErrors = refineResult.error.flatten().fieldErrors;
      const formErrors = refineResult.error.flatten().formErrors;
      if (fieldErrors.serviceSelections?.[0]) {
        setError("serviceSelections", {
          message: fieldErrors.serviceSelections[0],
        });
      } else if (formErrors[0]) {
        setError("serviceSelections", { message: formErrors[0] });
      }
      setStatus("idle");
      setFocus("comment");
      return;
    }

    // Snapshot display values for the success state before resetting the form.
    setSubmittedEmail(data.customerEmail);
    setSubmittedDate(data.date);
    setSubmittedTime(data.startTime);
    setSubmittedDuration(data.durationHours);
    setSubmittedVenueName(data.venueName);
    setSubmittedVenueCity(data.venueCity);

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
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
      setServerErrorMessage(
        "We couldn't submit your request right now. Please try again or email us.",
      );
    } catch {
      setStatus("error");
      setServerErrorMessage(
        "We couldn't reach the server. Please try again or email us.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        className="max-w-[680px] rounded-[16px] border border-[var(--border)] bg-[var(--accent)]/60 p-8"
        role="status"
        aria-live="polite"
      >
        <h2 className="font-primary text-[22px] font-bold text-[var(--foreground)]">
          Request received — thank you.
        </h2>
        <p className="mt-3 font-secondary text-[15px] leading-[1.65] text-[var(--muted-foreground)]">
          We've sent a confirmation email to{" "}
          <strong className="text-[var(--foreground)]">{submittedEmail}</strong>
          . Someone from the team will be in touch with a tailored offer
          shortly.
        </p>
        <dl className="mt-5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-secondary text-[14px]">
          <dt className="text-[var(--muted-foreground)]">When</dt>
          <dd>
            {submittedDate} at {submittedTime} ({submittedDuration}h)
          </dd>
          <dt className="text-[var(--muted-foreground)]">Where</dt>
          <dd>
            {submittedVenueName}, {submittedVenueCity}
          </dd>
        </dl>
        <button
          type="button"
          onClick={() => {
            reset();
            setQuantities({});
            setStatus("idle");
            setServerErrorMessage(null);
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
      onSubmit={handleSubmit(onValidSubmit)}
      noValidate
      className="flex max-w-[680px] flex-col gap-6"
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
          autoComplete="name"
          error={errors.customerName?.message}
          {...register("customerName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Email"
            id={`${formId}-customer-email`}
            type="email"
            autoComplete="email"
            error={errors.customerEmail?.message}
            {...register("customerEmail")}
          />
          <Field
            label="Phone"
            id={`${formId}-customer-phone`}
            type="tel"
            autoComplete="tel"
            placeholder="+41 79 123 45 67"
            error={errors.customerPhone?.message}
            {...register("customerPhone")}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="font-primary text-[16px] font-bold text-[var(--foreground)]">
          When and where
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Date"
            id={`${formId}-date`}
            type="date"
            error={errors.date?.message}
            {...register("date")}
          />
          <Field
            label="Start time"
            id={`${formId}-start-time`}
            type="time"
            error={errors.startTime?.message}
            {...register("startTime")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor={`${formId}-duration`}
            className="font-primary text-[14px] font-medium text-[var(--foreground)]"
          >
            Duration (hours)
          </label>
          <p className="font-secondary text-[13px] text-[var(--muted-foreground)]">
            Minimum 5 hours.
          </p>
          <input
            id={`${formId}-duration`}
            type="number"
            min={5}
            max={24}
            step={1}
            className="w-[12ch] rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-secondary text-[15px]"
            aria-describedby={
              errors.durationHours ? `${formId}-duration-error` : undefined
            }
            {...register("durationHours", {
              valueAsNumber: true,
              setValueAs: (v) =>
                v === "" || v == null ? undefined : Number(v),
            })}
          />
          {errors.durationHours && (
            <p
              id={`${formId}-duration-error`}
              role="alert"
              className="font-secondary text-[13px] text-[color:var(--destructive,red)]"
            >
              {errors.durationHours.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Venue name"
            id={`${formId}-venue-name`}
            error={errors.venueName?.message}
            {...register("venueName")}
          />
          <Field
            label="City"
            id={`${formId}-venue-city`}
            error={errors.venueCity?.message}
            {...register("venueCity")}
          />
        </div>
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
        {errors.serviceSelections && (
          <p
            role="alert"
            className="font-secondary text-[13px] text-[color:var(--destructive,red)]"
          >
            {errors.serviceSelections.message}
          </p>
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
        <p className="font-secondary text-[13px] text-[var(--muted-foreground)]">
          Tell us anything that doesn't fit above — call times, dress code,
          parking, special requests.
        </p>
        <textarea
          id={`${formId}-comment`}
          rows={4}
          className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-secondary text-[15px]"
          aria-describedby={
            errors.comment ? `${formId}-comment-error` : undefined
          }
          {...register("comment")}
        />
        {errors.comment && (
          <p
            id={`${formId}-comment-error`}
            role="alert"
            className="font-secondary text-[13px] text-[color:var(--destructive,red)]"
          >
            {errors.comment.message}
          </p>
        )}
      </fieldset>

      {status === "error" && serverErrorMessage && (
        <p
          role="alert"
          className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-3 font-secondary text-[14px] text-[var(--foreground)]"
        >
          {serverErrorMessage}
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
          disabled={isSubmitting}
          className="w-full inline-flex items-center justify-center rounded-[10px] bg-[var(--foreground)] px-5 py-3 font-primary text-[15px] font-medium text-[var(--background)] disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? "Sending…" : "Request a booking"}
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

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  id: string;
  error?: string;
};

const Field = ({ label, id, error, ...inputProps }: FieldProps) => {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-primary text-[14px] font-medium text-[var(--foreground)]"
      >
        {label}
      </label>
      <input
        id={id}
        aria-describedby={error ? `${id}-error` : undefined}
        className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 font-secondary text-[15px]"
        {...inputProps}
      />
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="font-secondary text-[13px] text-[color:var(--destructive,red)]"
        >
          {error}
        </p>
      )}
    </div>
  );
};
