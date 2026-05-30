import Parser from "rss-parser";
import type { RawArticle, Ticker, TickerConfig } from "@/lib/types";
import { type Source, cleanExcerpt } from "./source";

/** Yahoo Finance のシンボル。未上場銘柄は対象外（undefined）。 */
const YAHOO_SYMBOL: Partial<Record<Ticker, string>> = {
  IONQ: "IONQ",
  XE: "XE",
  // ANTHROPIC は未上場のため Yahoo Finance の対象外
};

/**
 * Yahoo Finance のヘッドラインRSSから株価ニュースを取得する。
 * 注意: ブラウザ系 User-Agent を付けないと 404 で弾かれる。
 */
export class YahooFinanceSource implements Source {
  readonly name = "yahoo_finance" as const;

  private readonly parser = new Parser({
    headers: {
      // Yahoo はデフォルトUAを拒否するためブラウザ風UAを送る
      "User-Agent":
        "Mozilla/5.0 (compatible; my-automation/0.1; +https://github.com/koshiro-y-0/my-automation)",
    },
    timeout: 15_000,
  });

  async fetch(ticker: TickerConfig): Promise<RawArticle[]> {
    const symbol = YAHOO_SYMBOL[ticker.ticker];
    if (!symbol) return [];

    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
      symbol,
    )}&region=US&lang=en-US`;

    const feed = await this.parser.parseURL(url);
    const now = new Date().toISOString();

    return (feed.items ?? [])
      .filter((item) => item.link)
      .map((item) => ({
        ticker: ticker.ticker,
        source: this.name,
        title: cleanExcerpt(item.title, 300) || "(no title)",
        url: item.link as string,
        publishedAt: item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : now),
        excerpt: cleanExcerpt(item.contentSnippet ?? item.content),
      }));
  }
}
