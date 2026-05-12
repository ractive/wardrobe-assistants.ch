"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { subscribePush, unsubscribePush } from "@/app/(dashboard)/actions/push";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
 * (e.g. Safari < 16.4 not on home screen), or when NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * is absent (build-time env not set).
 */
export function PushSubscribeToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [hasVapid, setHasVapid] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // NEXT_PUBLIC_ vars are inlined at build time; safe to read at module top or
    // in effect — both are equivalent. Checking in the effect keeps all the
    // "is this supported?" logic together.
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return; // renders null — no inert button
    setHasVapid(true);

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
    if (!vapidKey) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(
          "Notifications blocked. Enable them in your browser settings to receive booking alerts.",
        );
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        // toJSON() didn't expose what the server needs — undo the local
        // subscription so the UI doesn't claim "on" while the server has
        // nothing to deliver to.
        await sub.unsubscribe();
        console.error(
          "[PushSubscribeToggle] subscription missing endpoint/keys",
        );
        toast.error("Couldn't enable notifications. Try a different browser.");
        return;
      }
      const result = await subscribePush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 255),
      });
      if (!result.success) {
        // Server-side persist failed — revert the browser-side subscription
        // so the toggle reflects reality.
        await sub.unsubscribe();
        console.error("[PushSubscribeToggle] server subscribePush failed");
        toast.error("Couldn't save your notification preference. Try again.");
        return;
      }
      // Only flip UI state once both browser and server agree.
      setSubscription(sub);
      toast.success("Notifications enabled.");
    } catch (err) {
      console.error("[PushSubscribeToggle] subscribe failed", err);
      toast.error("Couldn't enable notifications. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    if (!subscription) return;
    setLoading(true);
    try {
      const endpoint = subscription.endpoint;
      // Backend first: if the server delete fails we keep the local
      // subscription so the user can retry instead of being silently in
      // a desync state.
      const result = await unsubscribePush(endpoint);
      if (!result.success) {
        console.error("[PushSubscribeToggle] server unsubscribePush failed");
        toast.error("Couldn't save your notification preference. Try again.");
        return;
      }
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success("Notifications disabled.");
    } catch (err) {
      console.error("[PushSubscribeToggle] unsubscribe failed", err);
      toast.error("Couldn't disable notifications. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!hasVapid || !isSupported) return null;

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="notifications-toggle"
        checked={subscription !== null}
        onCheckedChange={(checked) => {
          if (checked) void subscribe();
          else void unsubscribe();
        }}
        disabled={loading}
        aria-label="Notifications"
      />
      <Label
        htmlFor="notifications-toggle"
        className="cursor-pointer select-none text-sm"
      >
        Notifications
      </Label>
    </div>
  );
}
