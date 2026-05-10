import { vi } from "vitest";

// Auto-used by `vi.mock("@/lib/email")` in tests. Returns undefined / default
// values so callers see a successful send without hitting Resend or the dev
// console.
export const sendEmail = vi.fn(async () => undefined);
export const sendTemplated = vi.fn(async () => undefined);
export const sendTemplatedBatch = vi.fn(async () => ({ sent: 0, failed: 0 }));
