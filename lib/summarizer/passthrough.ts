import type { RawArticle } from "@/lib/types";
import type { Summarizer } from "./summarizer";

/**
 * RSS/ソース由来の抜粋をそのまま概要として返す（MVP）。
 * 外部API不要・完全無料。抜粋が空ならタイトルで代替する。
 */
export class PassthroughSummarizer implements Summarizer {
  async summarize(article: RawArticle): Promise<string> {
    return article.excerpt.trim() || article.title;
  }
}
