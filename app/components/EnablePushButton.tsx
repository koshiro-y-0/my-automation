"use client";

import { useEffect, useState } from "react";

type State =
  | "checking"
  | "unsupported"
  | "unconfigured"
  | "ready" // 未購読・購読可能
  | "subscribed"
  | "denied"
  | "working";

/** base64url の VAPID 公開鍵を Uint8Array に変換（PushManager 用）。 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function EnablePushButton() {
  const [state, setState] = useState<State>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }

      const res = await fetch("/api/push/subscribe").then((r) => r.json());
      if (cancelled) return;
      if (!res.configured || !res.publicKey) {
        setState("unconfigured");
        return;
      }
      setPublicKey(res.publicKey);

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const existing = await reg?.pushManager.getSubscription();
      setState(existing ? "subscribed" : "ready");
    }
    init().catch(() => {
      if (!cancelled) setState("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    if (!publicKey) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "ready");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const ok = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      }).then((r) => r.ok);
      setState(ok ? "subscribed" : "ready");
    } catch {
      setState("ready");
    }
  }

  // 未対応/未設定時は何も表示しない（UIを汚さない）
  if (state === "checking" || state === "unsupported" || state === "unconfigured") {
    return null;
  }

  if (state === "subscribed") {
    return (
      <p className="text-xs text-teal-600 dark:text-teal-400">
        🔔 プッシュ通知が有効です
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-xs text-neutral-500">
        通知がブロックされています。ブラウザ設定から許可してください。
        <br />
        （iPhone はホーム画面に追加したアプリから許可が必要です）
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={state === "working"}
      className="rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-600 disabled:opacity-60"
    >
      {state === "working" ? "設定中…" : "🔔 新着を通知する"}
    </button>
  );
}
