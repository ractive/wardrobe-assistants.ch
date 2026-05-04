import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // bunny Pull Zone serves out/ directly. trailingSlash makes Next emit
  // services/index.html (rather than services.html) so /services and
  // /services/ both resolve cleanly without rewrites.
  trailingSlash: true,
  images: { unoptimized: true },
  reactCompiler: true,
};

export default nextConfig;
