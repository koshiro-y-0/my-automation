import type { RawArticle } from "@/lib/types";
import { type Enrichment, type Summarizer, clampScore } from "./summarizer";

/**
 * 1回の collect 実行中の Groq 使用量アキュムレータ（機能5: 消費量計測）。
 * pipeline が実行前に reset、実行後に読み取って Notion に記録する。
 */
export interface GroqRunStats {
  requests: number;
  tokens: number;
  /** 直近レスポンスの残りリクエスト数（取得できた場合） */
  remainingRequests: number | null;
  /** レート制限のリセットISO時刻（推定。取得できた場合） */
  resetAt: string;
  /** 429（レート上限）に当たったか */
  limited: boolean;
}

let groqStats: GroqRunStats = freshStats();

function freshStats(): GroqRunStats {
  return { requests: 0, tokens: 0, remainingRequests: null, resetAt: "", limited: false };
}

export function resetGroqStats(): void {
  groqStats = freshStats();
}

export function getGroqStats(): GroqRunStats {
  return groqStats;
}

/** "2m59.56s" / "45s" / "120" などの Groq reset 表記を秒に変換。 */
function parseResetSeconds(v: string | null): number | null {
  if (!v) return null;
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  let total = 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*m/);
  const sec = s.match(/(\d+(?:\.\d+)?)\s*s/);
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  if (h) total += Number(h[1]) * 3600;
  if (m) total += Number(m[1]) * 60;
  if (sec) total += Number(sec[1]);
  return total || null;
}

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
              '{"titleJa": string, "summary": string, "relevance": 1-5の整数, "importance": 1-5の整数}。' +
              "titleJa は記事タイトルの自然な日本語訳（元が日本語ならそのまま、媒体名の付与は不要）。" +
              "企業名・製品名・サービス名などの固有名詞は翻訳せず原表記（英字）のまま残すこと（例: IonQ, Anthropic, OpenAI はそのまま）。" +
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

    // 使用量計測（機能5）: リクエスト数・残量・リセット時刻を捕捉
    groqStats.requests += 1;
    const remaining = res.headers.get("x-ratelimit-remaining-requests");
    if (remaining !== null) groqStats.remainingRequests = Number(remaining);
    const resetSec = parseResetSeconds(
      res.headers.get("x-ratelimit-reset-requests"),
    );
    if (resetSec !== null) {
      groqStats.resetAt = new Date(Date.now() + resetSec * 1000).toISOString();
    }

    if (res.status === 429) {
      groqStats.limited = true;
      throw new Error("Groq rate limited (429)");
    }
    if (!res.ok) {
      throw new Error(`Groq responded ${res.status}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    groqStats.tokens += data.usage?.total_tokens ?? 0;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      titleJa?: unknown;
      summary?: unknown;
      relevance?: unknown;
      importance?: unknown;
    };
    const summary =
      typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    if (!summary) return null;
    const titleJa =
      typeof parsed.titleJa === "string" ? parsed.titleJa.trim() : "";

    return {
      summary,
      titleJa,
      relevance: clampScore(parsed.relevance),
      importance: clampScore(parsed.importance),
      enriched: true,
    };
  }
}

/** Groq が利用可能か（APIキーが設定されているか）。 */
export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

/**
 * Groq で自由形式テキストを生成する（AIピックアップ／チャット回答用）。
 * 使用量アキュムレータ(groqStats)も更新する。失敗・429・未設定は null を返す。
 * opts.model で呼び出しごとにモデルを上書き可能（チャットは軽量モデルを使う）。
 */
export async function groqComplete(
  system: string,
  user: string,
  maxTokens = 400,
  opts?: { model?: string },
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model =
    opts?.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    groqStats.requests += 1;
    const resetSec = parseResetSeconds(
      res.headers.get("x-ratelimit-reset-requests"),
    );
    if (resetSec !== null) {
      groqStats.resetAt = new Date(Date.now() + resetSec * 1000).toISOString();
    }
    if (res.status === 429) {
      groqStats.limited = true;
      return null;
    }
    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    groqStats.tokens += data.usage?.total_tokens ?? 0;
    return (data.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch {
    return null;
  }
}
