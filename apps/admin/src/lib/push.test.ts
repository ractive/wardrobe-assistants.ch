import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock web-push before importing push.ts — lazy import inside sendPush
// means vi.mock intercepts the dynamic import at test time.
vi.mock("web-push", () => {
  const sendNotification = vi.fn();
  const setVapidDetails = vi.fn();
  return {
    default: { sendNotification, setVapidDetails },
    sendNotification,
    setVapidDetails,
  };
});

vi.mock("@/lib/db", () => ({ db: makeDbMock() }));

vi.mock("@/lib/env", () => ({
  env: {
    nodeEnv: "test",
    vapidPublicKey: "test-pub-key",
    vapidPrivateKey: "test-priv-key",
    vapidSubject: "mailto:test@example.com",
  },
}));

import { db } from "@/lib/db";
import { sendPush } from "./push";

interface DbMock {
  _selectResult: unknown[];
  _deleteEndpoints: string[];
  select: () => { from: () => { where: () => Promise<unknown[]> } };
  delete: () => { where: () => Promise<void> };
}

function makeDbMock(): DbMock {
  return {
    _selectResult: [],
    _deleteEndpoints: [],
    select() {
      const self = this;
      return {
        from() {
          return {
            where() {
              return Promise.resolve(self._selectResult);
            },
          };
        },
      };
    },
    delete() {
      const self = this;
      return {
        where() {
          // Record that a delete was attempted (endpoint captured from context).
          self._deleteEndpoints.push("deleted");
          return Promise.resolve();
        },
      };
    },
  };
}

const dbMock = db as unknown as DbMock;

const fakeSub = {
  id: "sub-1",
  userId: "user-1",
  endpoint: "https://push.example.com/sub/abc",
  p256dh: "key123",
  auth: "auth456",
  userAgent: null,
  createdAt: new Date(),
  lastUsedAt: null,
};

beforeEach(async () => {
  dbMock._selectResult = [fakeSub];
  dbMock._deleteEndpoints = [];
  const wp = (await import("web-push")).default;
  (wp.sendNotification as ReturnType<typeof vi.fn>).mockReset();
  (wp.setVapidDetails as ReturnType<typeof vi.fn>).mockReset();
  (wp.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue(
    undefined,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendPush", () => {
  it("calls setVapidDetails and sendNotification for each subscription", async () => {
    const result = await sendPush("user-1", {
      title: "Hello",
      body: "World",
    });

    expect(result.sent).toBe(1);

    const wp = (await import("web-push")).default;
    expect(wp.setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "test-pub-key",
      "test-priv-key",
    );
    expect(wp.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: fakeSub.endpoint,
        keys: { p256dh: fakeSub.p256dh, auth: fakeSub.auth },
      },
      JSON.stringify({ title: "Hello", body: "World" }),
    );
  });

  it("returns sent:0 when no subscriptions exist", async () => {
    dbMock._selectResult = [];
    const result = await sendPush("user-no-subs", { title: "Hi", body: "B" });
    expect(result.sent).toBe(0);

    const wp = (await import("web-push")).default;
    expect(wp.sendNotification).not.toHaveBeenCalled();
  });

  it("deletes stale subscription on 410 and does not count as sent", async () => {
    const wp = (await import("web-push")).default;
    const err = Object.assign(new Error("Gone"), { statusCode: 410 });
    (wp.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    const result = await sendPush("user-1", { title: "Hi", body: "B" });
    expect(result.sent).toBe(0);
    expect(dbMock._deleteEndpoints).toHaveLength(1);
  });

  it("deletes stale subscription on 404", async () => {
    const wp = (await import("web-push")).default;
    const err = Object.assign(new Error("Not Found"), { statusCode: 404 });
    (wp.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    const result = await sendPush("user-1", { title: "Hi", body: "B" });
    expect(result.sent).toBe(0);
    expect(dbMock._deleteEndpoints).toHaveLength(1);
  });

  it("logs and skips on non-404/410 errors without deleting", async () => {
    const wp = (await import("web-push")).default;
    const err = Object.assign(new Error("Server error"), { statusCode: 500 });
    (wp.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue(err);

    const result = await sendPush("user-1", { title: "Hi", body: "B" });
    expect(result.sent).toBe(0);
    // No row deleted for non-stale errors.
    expect(dbMock._deleteEndpoints).toHaveLength(0);
  });
});
