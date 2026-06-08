import { NextResponse } from "next/server";
import { collect } from "@/lib/pipeline";
import { generatePicks } from "@/lib/picks/generate";

// Node.js ランタイムで実行（crypto / 外部fetch / 長めの実行時間が必要）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 収集パイプラインのトリガ（Vercel Cron が毎朝呼ぶ）。
 * 認可: Vercel Cron は実行時に Authorization: Bearer <CRON_SECRET> を付与する。
 * 手動実行も同ヘッダで可能。
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
    const result = await collect();
    // 収集後に各企業のAIピックアップを生成（Groq未設定/ロック中は内部でskip）
    let picks = { generated: 0, skipped: null as string | null };
    try {
      picks = await generatePicks();
    } catch {
      // ピック生成の失敗は収集結果に影響させない
    }
    return NextResponse.json({ ok: true, ...result, picks });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
