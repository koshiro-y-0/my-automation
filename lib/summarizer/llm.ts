import type { RawArticle } from "@/lib/types";
import type { Summarizer } from "./summarizer";

/**
 * Groq（非Gemini・無料枠・OpenAI互換API）で日本語要約を生成する Summarizer。
 *
 * 設計方針:
 * - 外部SDKを足さず fetch で呼ぶ（依存を増やさない）。
 * - GROQ_API_KEY 未設定 / API失敗 / 空応答 は必ず fallback（既定: Passthrough）へ。
 *   → 要約が落ちても収集パイプラインは止めない。
 * - モデルは GROQ_MODEL で上書き可能（Groqはモデルを随時入替えるため）。
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

  async summarize(article: RawArticle): Promise<string> {
    if (!this.apiKey) return this.fallback.summarize(article);

    try {
      const summary = await this.callGroq(article);
      return summary || this.fallback.summarize(article);
    } catch {
      // レート超過・モデル廃止・ネットワーク等は静かにフォールバック
      return this.fallback.summarize(article);
    }
  }

  private async callGroq(article: RawArticle): Promise<string> {
    const userContent = [
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
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "あなたは米国株のニュースを扱う金融アナリストです。" +
              "与えられた記事のタイトルと抜粋【だけ】を根拠に、日本語2文以内で簡潔に要約してください。" +
              "本文抜粋が乏しい・無い場合は、推測で内容を補わず、タイトルを自然な日本語に言い換える程度にとどめます。" +
              "与えられていない事実・数値・背景を創作してはいけません。" +
              "同じ内容を繰り返さず、投資助言・前置き・記号は書かず、要約本文のみを出力します。",
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
    return (data.choices?.[0]?.message?.content ?? "").trim();
  }
}
