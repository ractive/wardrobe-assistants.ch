import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest workspace config. Iter-7a only has apps/marketing; iter-7b adds
// apps/admin and packages/db here as additional projects.
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "marketing",
          environment: "happy-dom",
          include: ["apps/marketing/src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
    ],
  },
});
