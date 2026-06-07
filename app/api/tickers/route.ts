import { NextResponse } from "next/server";
import { getTickers } from "@/lib/config/ticker-store";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * 監視銘柄の一覧（PWAのタブ生成用）。閲覧は公開。
 * 機密はキーワード等のみで、表示しても問題ない情報。
 */
export async function GET(): Promise<Response> {
  try {
    const tickers = await getTickers();
    return NextResponse.json({
      tickers: tickers.map((t) => ({
        ticker: t.ticker,
        name: t.name,
        listed: t.listed,
      })),
    });
  } catch (e) {
    return NextResponse.json({
      tickers: [],
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
