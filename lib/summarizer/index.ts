import type { Summarizer } from "./summarizer";
import { PassthroughSummarizer } from "./passthrough";
import { LlmSummarizer } from "./llm";

export type { Summarizer } from "./summarizer";

/**
 * SUMMARIZER 環境変数で要約方式を選択する。
 * - passthrough（既定）: RSS抜粋そのまま
 * - llm: Groq（非Gemini無料LLM）で日本語要約。キー未設定/失敗時は Passthrough にフォールバック。
 */
export function getSummarizer(): Summarizer {
  const mode = process.env.SUMMARIZER ?? "passthrough";
  switch (mode) {
    case "llm":
      return new LlmSummarizer(new PassthroughSummarizer());
    case "passthrough":
    default:
      return new PassthroughSummarizer();
  }
}
