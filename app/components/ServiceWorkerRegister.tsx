"use client";

import { useEffect } from "react";

/** Service Worker を登録する（オフライン対応）。本番でのみ有効化。 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 登録失敗はオフライン機能が使えないだけなので握りつぶす
    });
  }, []);

  return null;
}
