import { getStorage } from "@/lib/storage";
import type { NewsItem, Ticker } from "@/lib/types";

/**
 * チャット用ハイブリッド検索（v2.0 計画書 §4）。
 *   ② 質問のキーワードで記事を絞り込み（ピンポイント質問向け）
 *   → ヒットが少なければ ① 最近＋重要度上位で補完（「最近どう？」向け）
 *
 * 候補は当該銘柄の最新100件（Notionクエリ1回・LLM不使用＝ほぼ無料）。
 */

/** 文脈としてLLMに渡す最大記事数（入力トークン抑制） */
const MAX_CONTEXT = 8;
/** キーワードヒットがこの件数未満なら①で補完する */
const MIN_KEYWORD_HITS = 3;

/** 質問から検索語を抽出する際に無視する汎用語 */
const STOPWORDS = new Set([
  "について", "とは", "って", "まとめ", "教えて", "ください", "どう", "最近",
  "最新", "ニュース", "情報", "何", "なに", "ある", "あった", "する", "した",
  "です", "ます", "the", "is", "are", "was", "what", "how", "news", "about",
  "latest", "recent", "tell", "me",
]);

/**
 * 質問文から検索キーワードを抽出する。
 * 英数字の連なり / カタカナの連なり / 漢字の連なり を語として拾う
 * （日本語は分かち書きされないため、文字種の境界で近似する）。
 */
export function extractKeywords(question: string): string[] {
  const matches =
    question.match(/[A-Za-z0-9][A-Za-z0-9.\-]*|[ァ-ヶー]{2,}|[一-龠]{2,}/g) ??
    [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const kw = raw.trim();
    const lower = kw.toLowerCase();
    if (kw.length < 2 || STOPWORDS.has(lower) || STOPWORDS.has(kw)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(kw);
  }
  return out.slice(0, 8);
}

/** 記事1件が持つ検索対象テキスト */
function searchableText(item: NewsItem): string {
  return `${item.title} ${item.titleJa} ${item.summary}`.toLowerCase();
}

export interface RetrievalResult {
  articles: NewsItem[];
  /** どの方式で選ばれたか（回答プロンプトとデバッグ用） */
  mode: "keyword" | "recent" | "hybrid";
  keywords: string[];
}

/**
 * 質問に関連する記事を選ぶ。
 * キーワード一致数（多いほど上位）→ 重要度 → 新しさ の順で評価する。
 */
export async function retrieveArticles(
  ticker: Ticker,
  question: string,
): Promise<RetrievalResult> {
  const storage = getStorage();
  const candidates = await storage.list({ ticker, limit: 100, sort: "latest" });
  const keywords = extractKeywords(question);

  // ② キーワードスコアリング
  const scored = candidates
    .map((item) => {
      const text = searchableText(item);
      const hits = keywords.filter((kw) =>
        text.includes(kw.toLowerCase()),
      ).length;
      return { item, hits };
    })
    .filter((s) => s.hits > 0)
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        b.item.importance - a.item.importance ||
        b.item.publishedAt.localeCompare(a.item.publishedAt),
    );

  const keywordHits = scored.map((s) => s.item);

  // ① 最近＋重要度上位（補完用）
  const recentTop = [...candidates].sort(
    (a, b) =>
      b.importance - a.importance ||
      b.publishedAt.localeCompare(a.publishedAt),
  );

  if (keywordHits.length >= MIN_KEYWORD_HITS) {
    return {
      articles: keywordHits.slice(0, MAX_CONTEXT),
      mode: "keyword",
      keywords,
    };
  }
  if (keywordHits.length === 0) {
    return {
      articles: recentTop.slice(0, MAX_CONTEXT),
      mode: "recent",
      keywords,
    };
  }
  // 少数ヒット → ハイブリッド（ヒットを先頭に、残りを①で埋める）
  const ids = new Set(keywordHits.map((a) => a.id));
  const fill = recentTop.filter((a) => !ids.has(a.id));
  return {
    articles: [...keywordHits, ...fill].slice(0, MAX_CONTEXT),
    mode: "hybrid",
    keywords,
  };
}
