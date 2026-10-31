import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Vitest 5 made `Assertion<R, T>` two-parameter and expects custom matchers to
// be merged into `Matchers<R, T>` (which `Assertion` extends). jest-dom 7's
// bundled `@testing-library/jest-dom/vitest` typings still augment the old
// single-parameter `Assertion<T>`, so they no longer reach `expect(...)` —
// augment `Matchers` here instead. Runtime registration stays in
// tests/setup.ts (`import "@testing-library/jest-dom/vitest"`).
declare module "vitest" {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > extends TestingLibraryMatchers<unknown, R> {}
}
