import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import BookingAssigned from "../booking-assigned";
import BookingBroadcast from "../booking-broadcast";
import ParticipationRequested from "../participation-requested";
import PasswordReset from "../password-reset";
import UserDirectMessage from "../user-direct-message";
import VerifyEmail from "../verify-email";

describe("bookingAssigned template", () => {
  const params = {
    recipientName: "Alex",
    bookingName: "Spring Show",
    bookingDate: "Sunday, 1 March 2026",
    bookingVenue: "Theatre 1",
    bookingNotes: "Bring black",
    bookingUrl: "https://admin.wardrobe-assistants.ch/bookings/abc",
  };

  it("renders html snapshot", async () => {
    const html = await render(<BookingAssigned {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<BookingAssigned {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});

describe("bookingBroadcast template", () => {
  const params = {
    subject: "Reminder: call time is 7pm",
    bookingName: "Spring Show",
    body: "Hi all,\n\nJust a reminder that call time is 7pm.\n\nSee you there!",
  };

  it("renders html snapshot", async () => {
    const html = await render(<BookingBroadcast {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<BookingBroadcast {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});

describe("participationRequested template", () => {
  const params = {
    actorName: "Mira Adler",
    bookingName: "Spring Show",
    bookingDate: "Sunday, 1 March 2026",
    reviewUrl: "https://admin.wardrobe-assistants.ch/bookings/abc",
  };

  it("renders html snapshot", async () => {
    const html = await render(<ParticipationRequested {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<ParticipationRequested {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});

describe("passwordReset template", () => {
  const params = {
    resetUrl: "https://admin.wardrobe-assistants.ch/set-password?token=abc123",
  };

  it("renders html snapshot", async () => {
    const html = await render(<PasswordReset {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<PasswordReset {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});

describe("verifyEmail template", () => {
  const params = {
    verifyUrl: "https://admin.wardrobe-assistants.ch/verify?token=abc123",
  };

  it("renders html snapshot", async () => {
    const html = await render(<VerifyEmail {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<VerifyEmail {...params} />, { plainText: true });
    expect(text).toMatchSnapshot();
  });
});

describe("userDirectMessage template", () => {
  const params = {
    subject: "A message from the team",
    body: "Hi there,\n\nThis is a direct message.\n\nBest,\nThe team",
  };

  it("renders html snapshot", async () => {
    const html = await render(<UserDirectMessage {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<UserDirectMessage {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});
