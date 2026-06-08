import { getTickers } from "@/lib/config/ticker-store";
import { getStorage } from "@/lib/storage";
import {
  getGroqStats,
  groqComplete,
  isGroqConfigured,
  resetGroqStats,
} from "@/lib/summarizer/llm";
import { addUsage, getUsage, isGroqLocked } from "@/lib/usage/usage";
import type { NewsItem, Pick, TickerConfig } from "@/lib/types";
import { isPicksConfigured, savePick } from "./store";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ARTICLES = 10;

export interface GenerateResult {
  generated: number;
  skipped: string | null;
}

const SYSTEM_PROMPT =
  "あなたは米国株のアナリストです。指定企業に関する複数のニュースから、" +
  "投資家が押さえるべき注目ポイントを日本語の箇条書き3〜5点に集約してください。" +
  "各点は1文で簡潔に。事実に忠実に、与えられていない情報や数値は創作しないこと。" +
  "企業名・製品名などの固有名詞は原表記（英字）のまま。" +
  "前置きや結びは書かず、箇条書き（各行を「・」で開始）のみを出力すること。";

/**
 * 各企業の「気になる記事まとめ」を生成して保存する（AIピックアップ）。
 * 対象選定: 重要度降順→新しさ。直近7日を優先し、少なければ重要度上位で補完。
 * Groq未設定/ロック中/Picks DB未設定なら skip。
 */
export async function generatePicks(): Promise<GenerateResult> {
  if (!isPicksConfigured()) return { generated: 0, skipped: "picks-not-configured" };
  if (!isGroqConfigured()) return { generated: 0, skipped: "no-groq" };

  const usage = await getUsage();
  if (isGroqLocked(usage)) return { generated: 0, skipped: "groq-locked" };

  resetGroqStats();
  const tickers = await getTickers();
  const storage = getStorage();
  let generated = 0;

  for (const ticker of tickers) {
    const picked = await selectArticles(storage, ticker);
    if (picked.length === 0) continue;

    const digest = await groqComplete(
      SYSTEM_PROMPT,
      buildUserPrompt(ticker, picked),
      500,
    );
    if (!digest) continue; // レート制限・失敗時はその企業をスキップ（前回分を維持）

    await savePick({
      ticker: ticker.ticker,
      name: ticker.name,
      digest,
      articles: picked.map((a) => ({
        title: a.titleJa || a.title,
        url: a.url,
        importance: a.importance,
      })),
      generatedAt: new Date().toISOString(),
    });
    generated++;
  }

  // ピック生成ぶんのGroq使用量を記録
  const g = getGroqStats();
  await addUsage({
    groqRequests: g.requests,
    groqTokens: g.tokens,
    groqResetAt: g.resetAt || undefined,
    groqLimited: g.limited || undefined,
  });

  return { generated, skipped: null };
}

async function selectArticles(
  storage: ReturnType<typeof getStorage>,
  ticker: TickerConfig,
): Promise<NewsItem[]> {
  // 重要度降順で多めに取得 → 直近7日を優先、少なければ上位で補完
  const candidates = await storage.list({
    ticker: ticker.ticker,
    sort: "importance",
    limit: 40,
  });
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const recent = candidates.filter((a) => {
    const t = new Date(a.publishedAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  const base = recent.length >= 3 ? recent : candidates;
  return base.slice(0, MAX_ARTICLES);
}

function buildUserPrompt(ticker: TickerConfig, articles: NewsItem[]): string {
  const lines = articles.map((a) => {
    const title = a.titleJa || a.title;
    const body = a.summary ? `：${a.summary}` : "";
    return `・${title}${body}`;
  });
  return [
    `企業: ${ticker.name}（${ticker.ticker}）`,
    "以下は直近の関連ニュースです。注目ポイントを集約してください。",
    ...lines,
  ].join("\n");
}
