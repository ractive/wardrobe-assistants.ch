import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: makeDbMock() }));
vi.mock("@/lib/email", () => ({
  sendTemplated: vi.fn(async () => {}),
}));
vi.mock("@/lib/push", () => ({
  sendPush: vi.fn(async () => ({ sent: 1 })),
}));

import { db } from "@/lib/db";
import { sendTemplated } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { notifyUser } from "./notify";

interface DbMock {
  _selectResult: unknown[];
  select: () => {
    from: () => { where: () => { limit: () => Promise<unknown[]> } };
  };
}

function makeDbMock(): DbMock {
  return {
    _selectResult: [{ email: "user@example.com" }],
    select() {
      const self = this;
      return {
        from() {
          return {
            where() {
              return {
                limit() {
                  return Promise.resolve(self._selectResult);
                },
              };
            },
          };
        },
      };
    },
  };
}

const dbMock = db as unknown as DbMock;
const sendTemplatedMock = sendTemplated as unknown as ReturnType<typeof vi.fn>;
const sendPushMock = sendPush as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  dbMock._selectResult = [{ email: "user@example.com" }];
  sendTemplatedMock.mockReset().mockResolvedValue(undefined);
  sendPushMock.mockReset().mockResolvedValue({ sent: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("notifyUser", () => {
  it("fires both email and push for eventAssigned", async () => {
    await notifyUser("user-1", "eventAssigned", {
      recipientName: "Alice",
      eventName: "Spring Gala",
      eventDate: "Saturday, 1 March 2026",
      eventVenue: "Studio A",
      eventUrl: "https://admin.example.com/events/e1",
    });

    expect(sendTemplatedMock).toHaveBeenCalledOnce();
    expect(sendTemplatedMock).toHaveBeenCalledWith(
      "eventAssigned",
      "user@example.com",
      expect.objectContaining({ eventName: "Spring Gala" }),
    );
    expect(sendPushMock).toHaveBeenCalledOnce();
    expect(sendPushMock).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Assigned to Spring Gala" }),
    );
  });

  it("fires both email and push for userDirectMessage", async () => {
    await notifyUser("user-2", "userDirectMessage", {
      subject: "Hey there",
      body: "This is a test.",
    });

    expect(sendTemplatedMock).toHaveBeenCalledOnce();
    expect(sendPushMock).toHaveBeenCalledOnce();
    expect(sendPushMock).toHaveBeenCalledWith(
      "user-2",
      expect.objectContaining({ title: "Hey there" }),
    );
  });

  it("push failure does not block email", async () => {
    sendPushMock.mockRejectedValue(new Error("push down"));

    await expect(
      notifyUser("user-1", "userDirectMessage", {
        subject: "Test",
        body: "Body",
      }),
    ).resolves.toBeUndefined();

    // Email still fired despite push failure.
    expect(sendTemplatedMock).toHaveBeenCalledOnce();
  });

  it("email failure does not block push", async () => {
    sendTemplatedMock.mockRejectedValue(new Error("SMTP down"));

    await expect(
      notifyUser("user-1", "userDirectMessage", {
        subject: "Test",
        body: "Body",
      }),
    ).resolves.toBeUndefined();

    // Push still fired despite email failure.
    expect(sendPushMock).toHaveBeenCalledOnce();
  });

  it("throws AggregateError when both channels fail", async () => {
    sendTemplatedMock.mockRejectedValue(new Error("SMTP down"));
    sendPushMock.mockRejectedValue(new Error("push down"));

    await expect(
      notifyUser("user-1", "userDirectMessage", {
        subject: "Test",
        body: "Body",
      }),
    ).rejects.toBeInstanceOf(AggregateError);
  });

  it("returns early when user not found", async () => {
    dbMock._selectResult = [];

    await notifyUser("unknown-user", "userDirectMessage", {
      subject: "Hello",
      body: "Hi",
    });

    expect(sendTemplatedMock).not.toHaveBeenCalled();
    expect(sendPushMock).not.toHaveBeenCalled();
  });
});
