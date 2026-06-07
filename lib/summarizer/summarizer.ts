import type { RawArticle } from "@/lib/types";

/**
 * 記事1件のAIエンリッチ結果（設計書 §6 / 機能拡張: ★評価）。
 * - summary: 日本語要約
 * - relevance: 関連度 1〜5（銘柄・テーマへの関連性）
 * - importance: 重要度 1〜5（市場・投資判断へのインパクト）
 */
export interface Enrichment {
  summary: string;
  relevance: number;
  importance: number;
}

/**
 * 概要生成＋スコアリングの抽象。
 * MVP は Passthrough（要約=RSS抜粋、スコア=中立3）。
 * llm は Groq（非Gemini無料LLM）で要約と関連度・重要度を1回の呼び出しで生成。
 */
export interface Summarizer {
  enrich(article: RawArticle): Promise<Enrichment>;
}

/** スコアを整数 1〜5 に丸める（不正値は既定 3）。 */
export function clampScore(value: unknown, fallback = 3): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(5, Math.max(1, n));
}
