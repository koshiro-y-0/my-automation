import { NextResponse } from "next/server";
import { isAdmin, isAdminConfigured } from "@/lib/auth";
import { addTicker, deactivateTicker } from "@/lib/config/ticker-store";
import { deletePick } from "@/lib/picks/store";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 1回のDELETEでアーカイブする記事数（残りはhasMoreで再実行） */
const ARCHIVE_BATCH = 60;

/** 管理機能の有効/無効を返す（パスワード設定の有無）。値は返さない。 */
export async function GET(): Promise<Response> {
  return NextResponse.json({ adminConfigured: isAdminConfigured() });
}

/**
 * 監視銘柄を削除する（管理者のみ）。
 *   1. 設定DBを Active=false（収集・タブ・ピック対象から除外）
 *   2. ピック行を削除
 *   3. ニュース記事をバッチでアーカイブ（多い場合は hasMore=true、UIが再実行）
 * 認可: x-admin-password ヘッダが ADMIN_PASSWORD と一致すること。
 */
export async function DELETE(request: Request): Promise<Response> {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD is not configured" },
      { status: 503 },
    );
  }
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tickerParam = new URL(request.url).searchParams.get("ticker");
  const ticker =
    tickerParam && /^[A-Za-z0-9._-]{1,20}$/.test(tickerParam)
      ? tickerParam.toUpperCase()
      : "";
  if (!ticker) {
    return NextResponse.json(
      { ok: false, error: "ticker クエリが必要です" },
      { status: 400 },
    );
  }

  try {
    // 1〜2は冪等なので毎回呼んでよい（ループ時も安全）
    await deactivateTicker(ticker);
    await deletePick(ticker).catch(() => {});
    // 3. 記事をバッチでアーカイブ
    const { archived, hasMore } = await getStorage().archiveByTicker(
      ticker,
      ARCHIVE_BATCH,
    );
    return NextResponse.json({ ok: true, archived, hasMore });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/**
 * 監視銘柄を追加する（管理者のみ）。
 * 認可: x-admin-password ヘッダが ADMIN_PASSWORD と一致すること。
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD is not configured" },
      { status: 503 },
    );
  }
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const input = parseInput(body);
  if (!input) {
    return NextResponse.json(
      { ok: false, error: "ticker と name は必須です" },
      { status: 400 },
    );
  }

  try {
    await addTicker(input);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

function parseInput(body: unknown) {
  const b = body as {
    ticker?: unknown;
    name?: unknown;
    keywords?: unknown;
    listed?: unknown;
    yahooSymbol?: unknown;
    cik?: unknown;
  };
  const ticker = typeof b?.ticker === "string" ? b.ticker.trim().toUpperCase() : "";
  const name = typeof b?.name === "string" ? b.name.trim() : "";
  if (!ticker || !name) return null;

  const keywords = Array.isArray(b.keywords)
    ? b.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim())
    : typeof b.keywords === "string"
      ? b.keywords.split(",").map((k) => k.trim()).filter(Boolean)
      : [];

  return {
    ticker,
    name,
    keywords: keywords.length > 0 ? keywords : [name],
    listed: Boolean(b.listed),
    yahooSymbol:
      typeof b.yahooSymbol === "string" && b.yahooSymbol.trim()
        ? b.yahooSymbol.trim()
        : undefined,
    cik:
      typeof b.cik === "string" && b.cik.trim() ? b.cik.trim() : undefined,
  };
}
