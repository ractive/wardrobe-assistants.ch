import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest workspace config. iter-7a added apps/marketing; iter-7b adds
// apps/admin (UI + middleware + scripts) and packages/db (schema/migrations).
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
      {
        extends: true,
        test: {
          name: "admin",
          environment: "happy-dom",
          include: [
            "apps/admin/src/**/*.{test,spec}.{ts,tsx}",
            "apps/admin/middleware.test.ts",
            "apps/admin/scripts/**/*.{test,spec}.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["packages/db/src/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
});
