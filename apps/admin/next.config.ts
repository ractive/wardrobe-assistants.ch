import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: emits a self-contained server.js + minimal node_modules
  // under .next/standalone, suitable for the admin Magic Container image.
  output: "standalone",
  reactCompiler: true,
  // Trace from the workspace root so standalone packs @wardrobe-assistants/db
  // alongside the admin app.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
};

export default nextConfig;
