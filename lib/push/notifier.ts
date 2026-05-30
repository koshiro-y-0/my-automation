import webpush from "web-push";
import { getSubscriptionStore } from "./store";
import type { PushPayload, PushRecord } from "./types";

let configured = false;

/**
 * VAPID 設定を一度だけ行う。鍵が無ければ false（プッシュ無効）。
 */
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/** プッシュ通知が有効か（鍵 + 購読ストアの両方が設定済みか）。 */
export function isPushEnabled(): boolean {
  return ensureConfigured() && getSubscriptionStore() !== null;
}

/**
 * 全購読者へ通知を送る。死んだ購読（404/410）は自動で削除する。
 * 鍵/ストア未設定なら何もしない（戻り値 sent=0）。
 */
export async function broadcast(
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const store = getSubscriptionStore();
  if (!ensureConfigured() || !store) return { sent: 0, removed: 0 };

  const records = await store.all();
  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  for (const rec of records) {
    try {
      await sendOne(rec, body);
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await store.remove(rec.endpoint).catch(() => {});
        removed++;
      }
      // それ以外の失敗はスキップ（1件で全体を止めない）
    }
  }
  return { sent, removed };
}

function sendOne(rec: PushRecord, body: string): Promise<unknown> {
  return webpush.sendNotification(
    {
      endpoint: rec.endpoint,
      keys: { p256dh: rec.p256dh, auth: rec.auth },
    },
    body,
  );
}
