"use client";

import { useEffect, useState } from "react";

/**
 * iOS-specific "Add to Home Screen" hint.
 *
 * Renders only on iOS Safari outside standalone mode — Android/desktop
 * browsers show their own native install prompt. Per the Next.js 16 PWA
 * guide, we do not wire `beforeinstallprompt` for a custom button because
 * it is not cross-browser and does not work on Safari iOS.
 */
export function InstallPrompt() {
  const [mounted, setMounted] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setMounted(true);
    // iPadOS 13+ in "Request Desktop Site" mode reports as MacIntel with
    // touch — check both UA and that fallback so iPad isn't missed.
    const ua = navigator.userAgent;
    const uaIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const ipadOS =
      navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    setIsIOS(uaIOS || ipadOS);
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  // SSR / pre-mount renders nothing (matches server output, no hydration mismatch).
  // Already installed or not iOS — also nothing to show.
  if (!mounted || isStandalone || !isIOS) return null;

  return (
    <p className="px-4 py-2 text-muted-foreground text-xs" role="status">
      To install this app on your iPhone, tap the Share button and then "Add to
      Home Screen".
    </p>
  );
}
