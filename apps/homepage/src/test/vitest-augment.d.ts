// Type augmentations for vitest in the homepage test project.
// The admin app has its own copy; this is the homepage equivalent.
// Vitest 5 merges custom matchers into `Matchers<R, T>` (which `Assertion<R, T>`
// extends) — augmenting the old single-parameter `Assertion<T>` no longer
// reaches `expect(...)`.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends AxeMatchers,
      TestingLibraryMatchers<unknown, R> {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
