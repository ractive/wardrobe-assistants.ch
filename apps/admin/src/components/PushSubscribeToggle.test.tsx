import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

// Mock sonner toast.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the push server actions.
vi.mock("@/app/(dashboard)/actions/push", () => ({
  subscribePush: vi.fn(async () => ({ success: true })),
  unsubscribePush: vi.fn(async () => ({ success: true })),
}));

import { toast } from "sonner";
import { subscribePush } from "@/app/(dashboard)/actions/push";
import { PushSubscribeToggle } from "./PushSubscribeToggle";

// Helper to set up a minimal serviceWorker + PushManager environment in jsdom.
function setupServiceWorkerEnv(overrides?: {
  permissionResult?: NotificationPermission;
  subscribeResult?: Partial<PushSubscription>;
  subscribePushResult?: { success: boolean };
}) {
  const permission = overrides?.permissionResult ?? "granted";
  const mockSub: Partial<PushSubscription> = overrides?.subscribeResult ?? {
    endpoint: "https://push.example.com/sub",
    toJSON: () => ({
      endpoint: "https://push.example.com/sub",
      keys: { p256dh: "key123", auth: "auth456" },
    }),
    unsubscribe: vi.fn(async () => true),
  };

  const mockReg = {
    pushManager: {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => mockSub as PushSubscription),
    },
  };

  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      register: vi.fn(async () => mockReg),
      ready: Promise.resolve(mockReg),
    },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(window, "PushManager", {
    value: class PushManager {},
    configurable: true,
    writable: true,
  });

  Object.defineProperty(window, "Notification", {
    value: {
      requestPermission: vi.fn(async () => permission),
      permission,
    },
    configurable: true,
    writable: true,
  });

  if (overrides?.subscribePushResult !== undefined) {
    (subscribePush as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      overrides.subscribePushResult,
    );
  }

  return { mockReg, mockSub };
}

describe("PushSubscribeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set a fake VAPID key for each test; individual tests can override.
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "fakeVapidKey1234567890abcdef";
  });

  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    delete (window as unknown as Record<string, unknown>).PushManager;
    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it("returns null when NEXT_PUBLIC_VAPID_PUBLIC_KEY is unset", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const { container } = render(<PushSubscribeToggle />);
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it("returns null when serviceWorker is unsupported (no VAPID check needed)", async () => {
    // serviceWorker is absent in baseline jsdom — don't set it up.
    const { container } = render(<PushSubscribeToggle />);
    await act(async () => {});
    expect(container.firstChild).toBeNull();
  });

  it("shows Enable notifications button when SW is supported and no subscription", async () => {
    setupServiceWorkerEnv();
    const { container } = render(<PushSubscribeToggle />);
    await waitFor(() => {
      expect(
        within(container).getByRole("button", {
          name: /enable push notifications/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it("calls subscribePush with endpoint+keys and shows success on happy path", async () => {
    setupServiceWorkerEnv();
    const { container } = render(<PushSubscribeToggle />);

    const btn = await within(container).findByRole("button", {
      name: /enable push notifications/i,
    });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(subscribePush).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://push.example.com/sub",
          keys: { p256dh: "key123", auth: "auth456" },
        }),
      );
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("fires a toast when Notification permission is denied", async () => {
    setupServiceWorkerEnv({ permissionResult: "denied" });
    const { container } = render(<PushSubscribeToggle />);

    const btn = await within(container).findByRole("button", {
      name: /enable push notifications/i,
    });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Notifications blocked"),
      );
    });
  });

  it("fires a toast when server subscribePush fails", async () => {
    setupServiceWorkerEnv({ subscribePushResult: { success: false } });
    const { container } = render(<PushSubscribeToggle />);

    const btn = await within(container).findByRole("button", {
      name: /enable push notifications/i,
    });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Couldn't save"),
      );
    });
  });

  it("fires a toast when subscription keys are missing", async () => {
    setupServiceWorkerEnv({
      subscribeResult: {
        endpoint: "https://push.example.com/sub",
        toJSON: () => ({
          endpoint: "https://push.example.com/sub",
          keys: {},
        }),
        unsubscribe: vi.fn(async () => true),
      },
    });
    const { container } = render(<PushSubscribeToggle />);

    const btn = await within(container).findByRole("button", {
      name: /enable push notifications/i,
    });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Couldn't enable"),
      );
    });
  });

  it("is axe-clean in unsupported env (returns null)", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const { container } = render(<PushSubscribeToggle />);
    await act(async () => {});
    expect(await axe(container)).toHaveNoViolations();
  });

  it("is axe-clean when showing the Enable notifications button", async () => {
    setupServiceWorkerEnv();
    const { container } = render(<PushSubscribeToggle />);
    await within(container).findByRole("button", {
      name: /enable push notifications/i,
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
