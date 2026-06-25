import { groqComplete } from "@/lib/summarizer/llm";
import type { NewsItem, Ticker } from "@/lib/types";
import { retrieveArticles } from "./retrieve";

/**
 * チャット回答の生成（v2.0）。
 * ハイブリッド検索で選んだ記事だけを文脈に、Groq（軽量モデル）で回答する。
 * 回答には参照記事を必ず添える（ハルシネーション抑制・出典明示）。
 */

/** チャット既定モデル。70bより省トークン・高速・高レート上限の軽量モデル。 */
const DEFAULT_CHAT_MODEL = "llama-3.1-8b-instant";

export interface ChatSource {
  ticker: string;
  title: string;
  url: string;
  importance: number;
  publishedAt: string;
}

export interface ChatAnswer {
  answer: string;
  sources: ChatSource[];
}

const SYSTEM_PROMPT =
  "あなたは米国株のニュースに詳しいアナリストです。" +
  "与えられた参考記事【だけ】を根拠に、ユーザーの質問へ日本語で簡潔に答えてください。" +
  "事実は記事番号で引用すること（例: …と報じられた[2]）。" +
  "参考記事が複数企業にまたがる場合は、どの企業の話かを明示する（記事の【企業名】を参照）。" +
  "参考記事に該当する情報が無い場合は、推測せず「収集済みの記事には該当する情報がありません」と答えること。" +
  "投資助言（買い/売りの推奨）はしない。企業名・製品名などの固有名詞は原表記のまま。" +
  "回答は3〜6文程度、必要なら箇条書き可。";

function buildContext(articles: NewsItem[], includeTicker: boolean): string {
  return articles
    .map((a, i) => {
      const title = a.titleJa || a.title;
      const date = a.publishedAt.slice(0, 10);
      // 全企業横断時は記事がどの企業のものか明示する
      const tag = includeTicker ? `【${a.ticker}】` : "";
      return `[${i + 1}] (${date}) ${tag}${title}\n${a.summary}`;
    })
    .join("\n\n");
}

/**
 * 質問に回答する。Groq失敗/レート制限時は null（呼び出し側で503に変換）。
 * ticker="ALL" で全企業横断の汎用質問に答える。
 */
export async function answerQuestion(
  ticker: Ticker | "ALL",
  tickerName: string,
  question: string,
): Promise<ChatAnswer | null> {
  const all = ticker === "ALL";
  const { articles } = await retrieveArticles(all ? undefined : ticker, question);
  if (articles.length === 0) {
    return {
      answer: all
        ? "収集済みの記事がまだありません。次回の自動収集をお待ちください。"
        : "この銘柄の収集済み記事がまだありません。次回の自動収集をお待ちください。",
      sources: [],
    };
  }

  const target = all ? "全監視企業（横断）" : `${tickerName}（${ticker}）`;
  const user = [
    `対象: ${target}`,
    `質問: ${question}`,
    "",
    "参考記事:",
    buildContext(articles, all),
  ].join("\n");

  const model = process.env.GROQ_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const answer = await groqComplete(SYSTEM_PROMPT, user, 600, { model });
  if (!answer) return null;

  return {
    answer,
    sources: articles.map((a) => ({
      ticker: a.ticker,
      title: a.titleJa || a.title,
      url: a.url,
      importance: a.importance,
      publishedAt: a.publishedAt,
    })),
  };
}
