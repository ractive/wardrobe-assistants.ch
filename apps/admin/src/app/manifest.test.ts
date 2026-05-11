import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("manifest()", () => {
  it("matches snapshot", () => {
    expect(manifest()).toMatchInlineSnapshot(`
      {
        "background_color": "#fdfbf9",
        "description": "Squad coordination for Wardrobe Assistants",
        "display": "standalone",
        "icons": [
          {
            "sizes": "192x192",
            "src": "/icon-192.png",
            "type": "image/png",
          },
          {
            "sizes": "512x512",
            "src": "/icon-512.png",
            "type": "image/png",
          },
          {
            "purpose": "maskable",
            "sizes": "512x512",
            "src": "/icon-maskable-512.png",
            "type": "image/png",
          },
        ],
        "name": "Wardrobe Assistants Admin",
        "short_name": "WA Admin",
        "start_url": "/",
        "theme_color": "#b94e3a",
      }
    `);
  });

  it("has bordeaux theme_color", () => {
    expect(manifest().theme_color).toBe("#b94e3a");
  });

  it("start_url is /", () => {
    expect(manifest().start_url).toBe("/");
  });

  it("includes maskable icon", () => {
    const icons = manifest().icons ?? [];
    const maskable = icons.find((i) => i.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable?.src).toBe("/icon-maskable-512.png");
  });
});
