import { NextResponse } from "next/server";
import { generatePicks } from "@/lib/picks/generate";

// Node.js ランタイム（外部fetch・やや長い実行時間）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AIピックアップ生成のトリガ（Vercel Cron）。
 * 収集(/api/cron/collect)とは別Cronで、収集の少し後に実行する。
 * 理由: 収集は新着60件をGroqで一括処理して分次レート上限(429)に当たりやすく、
 * 同一実行内でピックを生成するとロックされてスキップされ続けるため
 * （ピックが更新されない不具合の原因）。時間を空けてレート回復後に生成する。
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const picks = await generatePicks();
    return NextResponse.json({ ok: true, picks });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
