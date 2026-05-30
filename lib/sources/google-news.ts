import Parser from "rss-parser";
import type { RawArticle, TickerConfig } from "@/lib/types";
import { type Source, USER_AGENT, cleanExcerpt } from "./source";

/**
 * Google News RSS から銘柄関連ニュースを取得する。
 * クエリは銘柄の主要キーワードを OR で連結。日本語(JP)フィードを使用。
 */
export class GoogleNewsSource implements Source {
  readonly name = "google_news" as const;

  private readonly parser = new Parser({
    headers: { "User-Agent": USER_AGENT },
    timeout: 15_000,
  });

  async fetch(ticker: TickerConfig): Promise<RawArticle[]> {
    const query = ticker.keywords.slice(0, 3).join(" OR ");
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query,
    )}&hl=ja&gl=JP&ceid=JP:ja`;

    const feed = await this.parser.parseURL(url);
    const now = new Date().toISOString();

    return (feed.items ?? [])
      .filter((item) => item.link)
      .map((item) => ({
        ticker: ticker.ticker,
        source: this.name,
        title: cleanExcerpt(item.title, 300) || "(無題)",
        url: item.link as string,
        publishedAt: item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : now),
        excerpt: cleanExcerpt(item.contentSnippet ?? item.content),
      }));
  }
}
