import { vi } from "vitest";

// Auto-used by `vi.mock("@/lib/email")` in tests. Returns undefined so callers
// see a successful send without hitting Resend or the dev console.
export const sendEmail = vi.fn(async () => undefined);
