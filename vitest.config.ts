import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Vitest workspace config. iter-7a added apps/homepage; iter-7b adds
// apps/admin (UI + middleware + scripts) and packages/db (schema/migrations).
const adminSrc = fileURLToPath(new URL("./apps/admin/src", import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./tests/setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "homepage",
          environment: "happy-dom",
          include: ["apps/homepage/src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        extends: true,
        resolve: { alias: { "@": adminSrc } },
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
