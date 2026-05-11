// Type augmentations for vitest in the homepage test project.
// The admin app has its own copy; this is the homepage equivalent.
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import type { AxeMatchers } from "vitest-axe/matchers";

declare module "vitest" {
  interface Assertion<T = unknown>
    extends AxeMatchers,
      TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
