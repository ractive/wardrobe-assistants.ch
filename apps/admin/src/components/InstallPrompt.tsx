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
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window),
    );
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  // Already installed or not iOS — nothing to show.
  if (isStandalone || !isIOS) return null;

  return (
    <p className="px-4 py-2 text-muted-foreground text-xs" role="status">
      To install this app on your iPhone, tap the Share button and then "Add to
      Home Screen".
    </p>
  );
}
