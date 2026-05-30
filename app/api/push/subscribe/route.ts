import { NextResponse } from "next/server";
import { getSubscriptionStore } from "@/lib/push/store";
import type { PushRecord } from "@/lib/push/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: クライアントが購読に使う公開鍵と、機能の有効/無効を返す。 */
export async function GET(): Promise<Response> {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? null;
  const store = getSubscriptionStore();
  return NextResponse.json({
    configured: Boolean(publicKey) && store !== null,
    publicKey,
  });
}

/** POST: ブラウザの PushSubscription を保存する。 */
export async function POST(request: Request): Promise<Response> {
  const store = getSubscriptionStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, error: "Push is not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const record = toPushRecord(body);
  if (!record) {
    return NextResponse.json(
      { ok: false, error: "Invalid subscription" },
      { status: 400 },
    );
  }

  try {
    await store.save(record);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** ブラウザの PushSubscription(JSON) を PushRecord に変換・検証する。 */
function toPushRecord(body: unknown): PushRecord | null {
  const sub = body as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    typeof sub?.endpoint !== "string" ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys?.auth !== "string"
  ) {
    return null;
  }
  return {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  };
}
