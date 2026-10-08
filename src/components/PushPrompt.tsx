"use client";

import { useEffect, useState } from "react";

const LS_DISMISSED = "axisops_push_dismissed";
const LS_SUBSCRIBED = "axisops_push_subscribed";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (localStorage.getItem(LS_DISMISSED) || localStorage.getItem(LS_SUBSCRIBED)) return;

    // Never prompt on load: wait for a genuine user gesture first.
    const arm = () => {
      document.removeEventListener("click", arm);
      document.removeEventListener("scroll", arm);
      fetch("/api/push/subscribe")
        .then((r) => r.json())
        .then((cfg: { configured?: boolean }) => {
          if (cfg.configured) setVisible(true);
        })
        .catch(() => {});
    };
    document.addEventListener("click", arm, { once: true });
    document.addEventListener("scroll", arm, { once: true });
    return () => {
      document.removeEventListener("click", arm);
      document.removeEventListener("scroll", arm);
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      // Some embedded browsers never resolve requestPermission when the
      // profile-level permission is denied — fall back after 15s.
      const permission = await Promise.race([
        Notification.requestPermission(),
        new Promise<NotificationPermission>((r) => setTimeout(() => r("denied"), 15000)),
      ]);
      if (permission !== "granted") {
        setError("Notifications stay off — you can enable them later.");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const cfg = await (await fetch("/api/push/subscribe")).json();
      if (!cfg.configured || !cfg.publicKey) {
        setError("Push is not configured on this server yet.");
        setBusy(false);
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Could not save subscription.");
      localStorage.setItem(LS_SUBSCRIBED, "1");
      setVisible(false);
    } catch {
      setError("Could not enable notifications. Try again.");
    }
    setBusy(false);
  }

  function dismiss() {
    localStorage.setItem(LS_DISMISSED, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-sand-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-navy-900">Never miss a buyer message</p>
          <p className="mt-0.5 text-xs text-navy-800/70">
            Get instant alerts for chats, escrow payments and payouts. Free, one tap.
          </p>
          {error && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={enable}
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Enabling…" : "🔔 Enable alerts"}
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-navy-800/70 hover:text-navy-900"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
