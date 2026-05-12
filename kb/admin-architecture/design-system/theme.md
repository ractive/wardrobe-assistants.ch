---
title: Theme switcher
type: architecture
status: current
---

# Theme switcher

The admin ships **light / dark / system** mode toggle:

- Toggle component: `<ThemeToggle />` (`components/ThemeToggle.tsx`), vendored from `@shadcn/mode-toggle`. Anchored in the `DashboardSidebar` footer.
- Provider: `components/ThemeProvider.tsx` — thin wrapper around `NextThemesProvider` from `next-themes` (`^0.4.6`).
- Root layout wiring (CSP-nonce aware — `next-themes`'s anti-FOUC inline script must carry the proxy's per-request nonce or `strict-dynamic` blocks it):
  ```tsx
  // apps/admin/src/app/layout.tsx
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // …
  <html lang="en" suppressHydrationWarning>
    <body>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
      >
        {children}
      </ThemeProvider>
    </body>
  </html>
  ```
- `suppressHydrationWarning` on `<html>` prevents React from complaining about the class mismatch between server (no theme class) and client (theme class injected by `next-themes`).
- **No custom inline pre-hydration script** — `next-themes` injects its own when `attribute="class"`, and the `nonce` prop above is what keeps that script alive under the admin's strict CSP.
- **Client-only persistence** — theme is stored in `localStorage`; no server round-trip, no cookie.
- System mode reflects OS-level changes in real time without a page reload.

---

See also: [design-system index](README.md) · [tokens](tokens.md) · [blocks adopted](blocks.md)
