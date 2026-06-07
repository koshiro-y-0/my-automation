import type { RawArticle } from "@/lib/types";
import type { Enrichment, Summarizer } from "./summarizer";

/**
 * RSS/ソース由来の抜粋をそのまま概要として返す（MVP・外部API不要・完全無料）。
 * スコアは中立の 3 を返す（AI未使用のため判定しない）。
 */
export class PassthroughSummarizer implements Summarizer {
  async enrich(article: RawArticle): Promise<Enrichment> {
    return {
      summary: article.excerpt.trim() || article.title,
      relevance: 3,
      importance: 3,
    };
  }
}
