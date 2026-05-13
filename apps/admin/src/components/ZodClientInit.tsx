"use client";

import { z } from "zod";

// Disable Zod v4's JIT-compiled validator probe on the client.
//
// Zod v4 calls `new Function()` once on first use to detect whether
// compiled (faster) validators are available, falling back to the
// interpreter on throw. Under the admin CSP — `script-src 'self'
// 'nonce-...' 'strict-dynamic'`, no `'unsafe-eval'` — the probe is
// blocked and the browser surfaces a CSP violation in the console even
// though Zod's own try/catch handles the throw and uses the interpreter.
//
// `z.config({ jitless: true })` opts out of the probe entirely. The
// runtime cost is the same as today (we were already on the interpreted
// path because CSP blocked `Function`).
//
// Set as a module-level side effect (not in `useEffect`) so it runs
// synchronously when the bundle first executes — before any client
// component imports a schema. Mounted as `<ZodClientInit />` in
// `app/layout.tsx`; the `'use client'` directive puts this module in
// the client bundle. See node_modules/zod/v4/core/util.js: "Skip the
// probe under `jitless`: strict CSPs report the caught `new Function`".
z.config({ jitless: true });

export function ZodClientInit() {
  return null;
}
