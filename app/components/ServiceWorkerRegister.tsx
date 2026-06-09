"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録し、新バージョンを検知したら自動でリロードする（本番のみ）。
 * これにより、デプロイ後にホーム画面追加済みPWAでも手動再起動なしに最新UIへ更新される。
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // 既にSWが制御中なら「更新」シナリオ。初回登録時の不要なリロードは避ける。
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload(); // 新SWが制御を奪った＝新デプロイ。最新を読み込む
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        // 起動のたびに最新SWの有無をチェック（新版があれば install→skipWaiting で有効化）
        reg.update().catch(() => {});
      })
      .catch(() => {
        // 登録失敗はオフライン/自動更新が効かないだけなので握りつぶす
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  return null;
}
