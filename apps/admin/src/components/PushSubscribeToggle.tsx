"use client";

import { useEffect, useState } from "react";
import { subscribePush, unsubscribePush } from "@/app/(dashboard)/actions/push";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/**
 * Push notification subscription toggle for the dashboard header.
 *
 * Also registers the service worker on mount — it's the earliest Client
 * Component that runs in the authenticated session, making it the right
 * place for SW registration per the Next.js 16 PWA guide.
 *
 * Hidden when the browser doesn't support service workers or PushManager
 * (e.g. Safari < 16.4 not on home screen).
 */
export function PushSubscribeToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setIsSupported(true);

    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const sub = await reg.pushManager.getSubscription();
        setSubscription(sub);
      } catch (err) {
        console.error("[PushSubscribeToggle] SW registration failed", err);
      }
    })();
  }, []);

  async function subscribe() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn("[PushSubscribeToggle] NEXT_PUBLIC_VAPID_PUBLIC_KEY unset");
      return;
    }
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      setSubscription(sub);

      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (json.endpoint && json.keys?.p256dh && json.keys.auth) {
        await subscribePush({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          userAgent: navigator.userAgent.slice(0, 255),
        });
      }
    } catch (err) {
      console.error("[PushSubscribeToggle] subscribe failed", err);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!subscription) return;
    setLoading(true);
    try {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      setSubscription(null);
      await unsubscribePush(endpoint);
    } catch (err) {
      console.error("[PushSubscribeToggle] unsubscribe failed", err);
    } finally {
      setLoading(false);
    }
  }

  if (!isSupported) return null;

  return subscription ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void unsubscribe()}
      disabled={loading}
      aria-label="Disable push notifications"
    >
      {loading ? "..." : "Notifications on"}
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void subscribe()}
      disabled={loading}
      aria-label="Enable push notifications"
    >
      {loading ? "..." : "Enable notifications"}
    </Button>
  );
}
