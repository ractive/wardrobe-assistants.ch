import type { AxeMatchers } from "vitest-axe/matchers";

// See jest-dom.d.ts: Vitest 5 custom matchers merge into `Matchers<R, T>`.
declare module "vitest" {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
