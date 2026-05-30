import { TICKERS } from "@/lib/config/tickers";
import { urlToId } from "@/lib/hash";
import { broadcast, isPushEnabled } from "@/lib/push/notifier";
import { getSources } from "@/lib/sources";
import { getStorage } from "@/lib/storage";
import { getSummarizer } from "@/lib/summarizer";
import type { NewsItem, RawArticle } from "@/lib/types";

export interface CollectResult {
  fetched: number;
  unique: number;
  saved: number;
  skipped: number;
  notified: number;
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
  const summarizer = getSummarizer();
  const storage = getStorage();

  const errors: string[] = [];
  const raw: RawArticle[] = [];

  // 1. 取得（ソース×銘柄。失敗は握って継続）
  for (const ticker of TICKERS) {
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

  // 3. 要約 → NewsItem 化
  const now = new Date().toISOString();
  const items: NewsItem[] = [];
  for (const [id, article] of byId) {
    let summary: string;
    try {
      summary = await summarizer.summarize(article);
    } catch {
      summary = article.excerpt || article.title; // 要約失敗時はフォールバック
    }
    items.push({
      id,
      ticker: article.ticker,
      title: article.title,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt,
      summary,
      createdAt: now,
    });
  }

  // 4. 新着を特定 → 保存
  const existing = await storage.existingIds(items.map((i) => i.id));
  const fresh = items.filter((i) => !existing.has(i.id));
  const { saved, skipped } = await storage.saveMany(items);

  // 5. 新着があればプッシュ通知（鍵/購読未設定なら no-op）
  let notified = 0;
  if (fresh.length > 0 && isPushEnabled()) {
    try {
      const r = await broadcast(buildPayload(fresh));
      notified = r.sent;
    } catch {
      // 通知失敗は収集結果に影響させない
    }
  }

  return {
    fetched: raw.length,
    unique: items.length,
    saved,
    skipped,
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
