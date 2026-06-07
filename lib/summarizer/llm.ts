import type { RawArticle } from "@/lib/types";
import { type Enrichment, type Summarizer, clampScore } from "./summarizer";

/**
 * Groq（非Gemini・無料枠・OpenAI互換API）で
 * 日本語要約＋関連度・重要度スコアを「1回の呼び出し」で生成する Summarizer。
 *
 * 設計方針:
 * - 外部SDKを足さず fetch で呼ぶ。
 * - GROQ_API_KEY 未設定 / API失敗 / 不正応答 は必ず fallback（既定: Passthrough）へ。
 *   → 要約・採点が落ちても収集パイプラインは止めない。
 * - JSON モード（response_format=json_object）で構造化出力を得る。
 * - モデルは GROQ_MODEL で上書き可能。
 */
export class LlmSummarizer implements Summarizer {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly endpoint = "https://api.groq.com/openai/v1/chat/completions";

  constructor(
    private readonly fallback: Summarizer,
    apiKey = process.env.GROQ_API_KEY,
    model = process.env.GROQ_MODEL,
  ) {
    this.apiKey = apiKey;
    this.model = model || "llama-3.3-70b-versatile";
  }

  async enrich(article: RawArticle): Promise<Enrichment> {
    if (!this.apiKey) return this.fallback.enrich(article);
    try {
      const result = await this.callGroq(article);
      return result ?? (await this.fallback.enrich(article));
    } catch {
      // レート超過・モデル廃止・ネットワーク等は静かにフォールバック
      return this.fallback.enrich(article);
    }
  }

  private async callGroq(article: RawArticle): Promise<Enrichment | null> {
    const userContent = [
      `銘柄: ${article.ticker}`,
      `タイトル: ${article.title}`,
      article.excerpt ? `本文抜粋: ${article.excerpt}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "あなたは米国株のニュースを扱う金融アナリストです。" +
              "与えられた記事のタイトルと抜粋【だけ】を根拠に、次のJSONを返してください。" +
              '{"summary": string, "relevance": 1-5の整数, "importance": 1-5の整数}。' +
              "summary は事実に忠実な日本語2文以内。本文抜粋が乏しい・無い場合は推測で内容を補わず、" +
              "タイトルを自然な日本語に言い換える程度にとどめ、与えられていない事実・数値を創作しないこと。" +
              "relevance はその記事が指定銘柄・関連テーマにどれだけ直接関係するか（5=核心、1=ほぼ無関係）。" +
              "importance は市場・投資判断へのインパクト（5=決算/重大開示級、1=軽微）。" +
              "JSON以外は出力しないこと。",
          },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq responded ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      summary?: unknown;
      relevance?: unknown;
      importance?: unknown;
    };
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!summary) return null;

    return {
      summary,
      relevance: clampScore(parsed.relevance),
      importance: clampScore(parsed.importance),
    };
  }
}
