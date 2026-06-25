import { getTickers } from "@/lib/config/ticker-store";
import { urlToId } from "@/lib/hash";
import { broadcast, isPushEnabled } from "@/lib/push/notifier";
import { getSources } from "@/lib/sources";
import { getStorage } from "@/lib/storage";
import { getSummarizer } from "@/lib/summarizer";
import { PassthroughSummarizer } from "@/lib/summarizer/passthrough";
import { getGroqStats, resetGroqStats } from "@/lib/summarizer/llm";
import { addUsage, getUsage, isGroqLocked } from "@/lib/usage/usage";
import type { NewsItem, RawArticle } from "@/lib/types";

export interface CollectResult {
  fetched: number;
  unique: number;
  saved: number;
  skipped: number;
  notified: number;
  groqLocked: boolean;
  errors: string[];
}

/**
 * 収集パイプライン本体（設計書 §3）。
 *   取得 → 正規化(id付与) → 重複排除 → 要約 → 保存
 *
 * 原則:
 * - 冪等性: id=URLハッシュ で重複保存しない
 * - 部分的失敗の許容: 1ソース/1銘柄の失敗で全体を止めない（errors に記録）
 */
export async function collect(): Promise<CollectResult> {
  const sources = getSources();
  const storage = getStorage();

  // Groqが当日上限でロック中なら要約はPassthroughに切替（無駄打ち・課金リスク回避）
  resetGroqStats();
  const usageBefore = await getUsage();
  const groqLocked = isGroqLocked(usageBefore);
  const summarizer = groqLocked ? new PassthroughSummarizer() : getSummarizer();

  const errors: string[] = [];
  const raw: RawArticle[] = [];

  // 監視銘柄を取得（Notion設定DB優先、未設定なら静的既定）
  const tickers = await getTickers();

  // 1. 取得（ソース×銘柄。失敗は握って継続）
  for (const ticker of tickers) {
    for (const source of sources) {
      try {
        const articles = await source.fetch(ticker);
        raw.push(...articles);
      } catch (e) {
        errors.push(
          `${source.name}/${ticker.ticker}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }

  // 2. 正規化 + 重複排除（同一URLは1件に集約）
  const byId = new Map<string, RawArticle>();
  for (const article of raw) {
    const id = urlToId(article.url);
    if (!byId.has(id)) byId.set(id, article);
  }

  // 3. 新着を特定（保存・要約の前に行う）。
  //    既存記事を除外し、1回の実行件数を上限で制限（Vercel 60秒 / LLM無料枠対策）。
  //    冪等性（URLハッシュ）により、上限超過分は次回以降に取りこぼしなく保存される。
  //
  //    ★ 公平配分: 単純に先頭からslice すると、銘柄数が増えたとき処理順で後ろの
  //    銘柄（例: 5社目以降）が毎回打ち切られて永久に更新されない不具合があった。
  //    銘柄ごとにラウンドロビンで取り、全銘柄に保存枠を均等配分する。
  const allIds = [...byId.keys()];
  const existing = await storage.existingIds(allIds);
  const maxPerRun = Math.max(1, Number(process.env.MAX_SAVES_PER_RUN) || 60);

  const freshByTicker = new Map<string, Array<readonly [string, RawArticle]>>();
  for (const id of allIds) {
    if (existing.has(id)) continue;
    const article = byId.get(id)!;
    const list = freshByTicker.get(article.ticker) ?? [];
    list.push([id, article] as const);
    freshByTicker.set(article.ticker, list);
  }

  const freshArticles: Array<readonly [string, RawArticle]> = [];
  const queues = [...freshByTicker.values()];
  let progressed = true;
  while (freshArticles.length < maxPerRun && progressed) {
    progressed = false;
    for (const q of queues) {
      const next = q.shift();
      if (!next) continue;
      freshArticles.push(next);
      progressed = true;
      if (freshArticles.length >= maxPerRun) break;
    }
  }

  // 4. 新着のみエンリッチ（要約＋関連度・重要度）→ NewsItem 化
  //    LLM呼び出しは新着件数だけに抑制。失敗時は enrich 内部でフォールバック済み。
  const now = new Date().toISOString();
  const toSave: NewsItem[] = [];
  for (const [id, article] of freshArticles) {
    let summary = article.excerpt || article.title;
    let titleJa = "";
    let relevance = 3;
    let importance = 3;
    let enriched = false;
    try {
      const e = await summarizer.enrich(article);
      summary = e.summary;
      titleJa = e.titleJa;
      relevance = e.relevance;
      importance = e.importance;
      enriched = e.enriched;
    } catch {
      // enrich は内部でフォールバックするが、念のため既定値を維持
    }
    toSave.push({
      id,
      ticker: article.ticker,
      title: article.title,
      titleJa,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt,
      summary,
      relevance,
      importance,
      enriched,
      createdAt: now,
    });
  }

  // 5. 保存
  const { saved } = await storage.saveMany(toSave);
  const skipped = byId.size - saved;

  // 6. 実際に保存した新着があればプッシュ通知（鍵/購読未設定なら no-op）
  let notified = 0;
  if (toSave.length > 0 && isPushEnabled()) {
    try {
      const r = await broadcast(buildPayload(toSave));
      notified = r.sent;
    } catch {
      // 通知失敗は収集結果に影響させない
    }
  }

  // 7. API使用量を記録（機能5: Groqはヘッダー計測、Notion書込は概算=保存件数）
  const g = getGroqStats();
  await addUsage({
    groqRequests: g.requests,
    groqTokens: g.tokens,
    notionWrites: saved,
    collectRuns: 1,
    groqResetAt: g.resetAt || undefined,
    groqLimited: g.limited || undefined,
  });

  return {
    fetched: raw.length,
    unique: byId.size,
    saved,
    skipped,
    groqLocked,
    notified,
    errors,
  };
}

/** 新着ニュースから通知ペイロードを組み立てる。 */
function buildPayload(fresh: NewsItem[]) {
  if (fresh.length === 1) {
    const item = fresh[0];
    return {
      title: `[${item.ticker}] 新着ニュース`,
      body: item.title,
      url: "/",
    };
  }
  const tickers = [...new Set(fresh.map((i) => i.ticker))].join(" / ");
  return {
    title: `新着ニュース ${fresh.length}件`,
    body: `${tickers} の最新情報が届きました`,
    url: "/",
  };
}
