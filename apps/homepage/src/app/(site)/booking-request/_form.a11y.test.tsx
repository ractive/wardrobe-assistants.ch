// iter-31: a11y smoke for the BookingRequestForm in its three key states:
// empty (initial), error (after failed submit), and success.
//
// vitest-axe matchers are extended here because the homepage vitest project
// uses a separate setup from the admin app (which registers them in
// apps/admin/src/test/setup.ts).
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import * as axeMatchers from "vitest-axe/matchers";

expect.extend(axeMatchers);

import { BookingRequestForm, type ServiceEntry } from "./_form";

const SERVICES: ServiceEntry[] = [
  {
    id: "svc-1",
    name: "Quick changes",
    description: "Timed changes at every wing.",
    priceType: "hourly",
    price: 100,
  },
];

const SUBMIT_URL = "https://admin.example.com/api/public/booking-requests";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BookingRequestForm — a11y", () => {
  it("empty state has no axe violations", async () => {
    const { container } = render(
      <BookingRequestForm services={SERVICES} submitUrl={SUBMIT_URL} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("error state (field validation errors) has no axe violations", async () => {
    const { container } = render(
      <BookingRequestForm services={SERVICES} submitUrl={SUBMIT_URL} />,
    );

    // Submit the empty form to trigger validation errors.
    const submitButton = screen.getByRole("button", {
      name: /request a booking/i,
    });
    await userEvent.click(submitButton);

    // Wait for RHF to render error messages.
    await waitFor(() => {
      expect(screen.queryAllByRole("alert").length).toBeGreaterThan(0);
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("success state has no axe violations", async () => {
    // Mock fetch to return 200.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      ),
    );

    const { container } = render(
      <BookingRequestForm services={SERVICES} submitUrl={SUBMIT_URL} />,
    );

    // Fill in required fields with valid values.
    await userEvent.type(screen.getByLabelText(/your name/i), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText(/email/i), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/phone/i), "+41 79 000 00 00");
    await userEvent.type(screen.getByLabelText(/date/i), "2027-06-01");
    await userEvent.type(screen.getByLabelText(/start time/i), "18:00");
    await userEvent.type(screen.getByLabelText(/venue name/i), "Studio X");
    await userEvent.type(screen.getByLabelText(/city/i), "Zurich");

    // Add a comment to satisfy the refine (no service quantity set).
    await userEvent.type(
      screen.getByLabelText(/anything else/i),
      "Press night event.",
    );

    const submitButton = screen.getByRole("button", {
      name: /request a booking/i,
    });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("BookingRequestForm — duration input", () => {
  it("allows clearing duration and retyping a valid value", async () => {
    // Mock fetch to capture the submitted payload.
    let capturedBody: unknown;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    render(<BookingRequestForm services={[]} submitUrl={SUBMIT_URL} />);

    const durationInput = screen.getByLabelText(/duration/i);

    // Clear the default value and type a new one.
    await userEvent.clear(durationInput);
    await userEvent.type(durationInput, "8");

    // Fill required fields.
    await userEvent.type(screen.getByLabelText(/your name/i), "Test User");
    await userEvent.type(screen.getByLabelText(/email/i), "test@example.com");
    await userEvent.type(screen.getByLabelText(/phone/i), "+41 79 000 00 00");
    await userEvent.type(screen.getByLabelText(/date/i), "2027-06-01");
    await userEvent.type(screen.getByLabelText(/start time/i), "18:00");
    await userEvent.type(screen.getByLabelText(/venue name/i), "Theater Z");
    await userEvent.type(screen.getByLabelText(/city/i), "Basel");
    // Comment satisfies the refine (no services).
    await userEvent.type(
      screen.getByLabelText(/anything else/i),
      "Special notes.",
    );

    await userEvent.click(
      screen.getByRole("button", { name: /request a booking/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    // Submitted duration should be 8, not the default 5.
    expect((capturedBody as Record<string, unknown>).durationHours).toBe(8);
  });
});
