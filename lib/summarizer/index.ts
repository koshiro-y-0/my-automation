import type { Summarizer } from "./summarizer";
import { PassthroughSummarizer } from "./passthrough";

export type { Summarizer } from "./summarizer";

/**
 * SUMMARIZER 環境変数で要約方式を選択する。
 * - passthrough（既定）: RSS抜粋そのまま
 * - llm: 非Gemini無料LLM（feat/ai-summary で実装予定。未実装時は passthrough にフォールバック）
 */
export function getSummarizer(): Summarizer {
  const mode = process.env.SUMMARIZER ?? "passthrough";
  switch (mode) {
    case "llm":
      // TODO(feat/ai-summary): LlmSummarizer を実装したらここで返す
      return new PassthroughSummarizer();
    case "passthrough":
    default:
      return new PassthroughSummarizer();
  }
}
