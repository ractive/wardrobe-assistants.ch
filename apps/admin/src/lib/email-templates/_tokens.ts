/**
 * Email-safe palette: hex mirrors of the admin OKLCH brand tokens.
 *
 * Email clients can't share runtime CSS custom properties with the admin app
 * (Outlook desktop and many others don't support `var()`; OKLCH is too new to
 * rely on in email). React Email renders inline-styled HTML at server time —
 * no Tailwind pass — so we mirror the brand at compile time via these
 * constants instead.
 *
 * Maintenance: when the OKLCH brand palette in `apps/admin/src/app/globals.css`
 * changes, convert the new `--primary` / `--primary-foreground` / `--muted-foreground`
 * / `--border` / `--background` values to sRGB hex and update this file. No
 * compile-time link — this is a convention, not a guarantee.
 *
 * Anchored on the bordeaux palette (iter-32, TweakCN theme
 * cmnjexv1n000304jse9nq2jra).
 */

/** sRGB hex of --primary oklch(0.5596 0.1431 32.4368). */
export const brand = "#b94e3a";
/** sRGB hex of --primary-foreground oklch(1 0 0). */
export const brandForeground = "#ffffff";
/** sRGB hex of --muted-foreground oklch(0.4526 0.0416 234.9214). */
export const mutedForeground = "#3f5a6a";
/** sRGB hex of --border oklch(0.8860 0.0245 47.0944). */
export const border = "#e8d5cc";
/** sRGB hex of --background oklch(0.9891 0.0034 67.7840). */
export const background = "#fdfbf9";
