import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wardrobe Assistants Admin",
    short_name: "WA Admin",
    description: "Squad coordination for Wardrobe Assistants",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#7d2b3b", // bordeaux brand override (iter-16i)
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
