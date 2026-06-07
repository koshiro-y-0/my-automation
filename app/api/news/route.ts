import { NextResponse } from "next/server";
import { getStorage } from "@/lib/storage";
import type { SortKey } from "@/lib/storage";

export const runtime = "nodejs";
// Notion から都度読むが、表示の体感速度のため短時間キャッシュ（無料枠にも優しい）
export const revalidate = 300;

const VALID_SORTS: ReadonlySet<string> = new Set([
  "latest",
  "relevance",
  "importance",
]);
// 銘柄は動的に増えるため、形式（英数字・ハイフン）だけを軽く検証する。
const TICKER_RE = /^[A-Za-z0-9._-]{1,20}$/;

/**
 * PWA 向けニュース読み出しAPI。
 * Notion 未設定/接続失敗時も 500 にせず { items: [], configured: false } を返し、
 * フロントが「未接続」状態を案内できるようにする。
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const tickerParam = searchParams.get("ticker");
  const ticker =
    tickerParam && TICKER_RE.test(tickerParam) ? tickerParam : undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);
  const sortParam = searchParams.get("sort");
  const sort =
    sortParam && VALID_SORTS.has(sortParam) ? (sortParam as SortKey) : "latest";
  const enrichedOnly = searchParams.get("enriched") === "1";

  try {
    const storage = getStorage();
    const items = await storage.list({ ticker, limit, sort, enrichedOnly });
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
