import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import type { Ticker } from "@/lib/types";

export const runtime = "nodejs";
// Notion から都度読むが、表示の体感速度のため短時間キャッシュ（無料枠にも優しい）
export const revalidate = 300;

const VALID_TICKERS: ReadonlySet<string> = new Set(["IONQ", "XE", "ANTHROPIC"]);

/**
 * PWA 向けニュース読み出しAPI。
 * Notion 未設定/接続失敗時も 500 にせず { items: [], configured: false } を返し、
 * フロントが「未接続」状態を案内できるようにする。
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const tickerParam = searchParams.get("ticker");
  const ticker =
    tickerParam && VALID_TICKERS.has(tickerParam)
      ? (tickerParam as Ticker)
      : undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  try {
    const storage = getStorage();
    const items = await storage.list({ ticker, limit });
    return NextResponse.json({ configured: true, items });
  } catch (e) {
    // 環境変数未設定や Notion 接続失敗はユーザー向けに穏当に扱う
    return NextResponse.json({
      configured: false,
      items: [],
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
