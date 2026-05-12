import { render } from "react-email";
import { describe, expect, it } from "vitest";
import AssignmentInvite from "../assignment-invite";
import BookingBroadcast from "../booking-broadcast";
import ParticipationRequested from "../participation-requested";
import PasswordReset from "../password-reset";
import UserDirectMessage from "../user-direct-message";
import VerifyEmail from "../verify-email";
import WelcomeInvite from "../welcome-invite";

describe("assignmentInvite template", () => {
  const params = {
    recipientName: "Alex",
    bookingName: "Spring Show",
    bookingDate: "Sunday, 1 March 2026",
    bookingVenue: "Theatre 1",
    bookingNotes: "Bring black",
    confirmUrl:
      "https://admin.wardrobe-assistants.ch/my-bookings/abc?action=confirm",
    declineUrl:
      "https://admin.wardrobe-assistants.ch/my-bookings/abc?action=decline",
  };

  it("renders html snapshot", async () => {
    const html = await render(<AssignmentInvite {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<AssignmentInvite {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });

  it("renders Confirm and Decline buttons in the same table row", async () => {
    const html = await render(<AssignmentInvite {...params} />);
    // React Email Row renders as <table>, Column as <td>.
    // Require both buttons inside td siblings within the SAME <tr> — a
    // looser <table>...<td>...<td>...</table> match would silently accept
    // buttons split across separate rows.
    const sameTr =
      /<tr[^>]*>.*?<td[^>]*>.*?Confirm.*?<\/td>.*?<td[^>]*>.*?Decline.*?<\/td>.*?<\/tr>/s;
    expect(html).toMatch(sameTr);
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

describe("welcomeInvite template", () => {
  const params = {
    activateUrl:
      "https://admin.wardrobe-assistants.ch/set-password?token=abc123",
    firstName: "Alex",
  };

  it("renders html snapshot", async () => {
    const html = await render(<WelcomeInvite {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<WelcomeInvite {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });

  it("renders without firstName (greeting falls back to 'Welcome!')", async () => {
    const html = await render(
      <WelcomeInvite activateUrl={params.activateUrl} firstName={null} />,
    );
    expect(html).toContain("Welcome!");
    expect(html).not.toContain("Welcome, ");
  });

  it("uses welcome / activate copy, not 'reset password'", async () => {
    const html = await render(<WelcomeInvite {...params} />);
    expect(html).toContain("Activate your account");
    expect(html).not.toMatch(/reset your password/i);
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
