import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import EventAssigned from "../event-assigned";
import EventBroadcast from "../event-broadcast";
import ParticipationRequested from "../participation-requested";
import PasswordReset from "../password-reset";
import UserDirectMessage from "../user-direct-message";
import VerifyEmail from "../verify-email";

describe("eventAssigned template", () => {
  const params = {
    recipientName: "Alex",
    eventName: "Spring Show",
    eventDate: "Saturday, 1 March 2026",
    eventVenue: "Theatre 1",
    eventNotes: "Bring black",
    eventUrl: "https://admin.wardrobe-assistants.ch/events/abc",
  };

  it("renders html snapshot", async () => {
    const html = await render(<EventAssigned {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<EventAssigned {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});

describe("eventBroadcast template", () => {
  const params = {
    subject: "Reminder: call time is 7pm",
    eventName: "Spring Show",
    body: "Hi all,\n\nJust a reminder that call time is 7pm.\n\nSee you there!",
  };

  it("renders html snapshot", async () => {
    const html = await render(<EventBroadcast {...params} />);
    expect(html).toMatchSnapshot();
  });

  it("renders plaintext snapshot", async () => {
    const text = await render(<EventBroadcast {...params} />, {
      plainText: true,
    });
    expect(text).toMatchSnapshot();
  });
});

describe("participationRequested template", () => {
  const params = {
    actorName: "Mira Adler",
    eventName: "Spring Show",
    eventDate: "Saturday, 1 March 2026",
    reviewUrl: "https://admin.wardrobe-assistants.ch/events/abc",
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
