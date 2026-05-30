import type { RawArticle } from "@/lib/types";

/**
 * 概要生成の抽象（設計書 §6）。
 * MVP は Passthrough（RSS抜粋そのまま）。
 * 後続フェーズで非Gemini無料LLM（Groq等）の実装を差し込む。
 */
export interface Summarizer {
  summarize(article: RawArticle): Promise<string>;
}
