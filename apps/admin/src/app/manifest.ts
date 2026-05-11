import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wardrobe Assistants Admin",
    short_name: "WA Admin",
    description: "Squad coordination for Wardrobe Assistants",
    start_url: "/",
    display: "standalone",
    // sRGB hex mirror of --background oklch(0.9891 0.0034 67.7840) (iter-32).
    background_color: "#fdfbf9",
    // sRGB hex mirror of --primary oklch(0.5596 0.1431 32.4368) (iter-32 bordeaux).
    theme_color: "#b94e3a",
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
