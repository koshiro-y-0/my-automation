/**
 * コアドメイン型。設計書 docs/design.md §4 / §6 に対応。
 */

/** 監視銘柄 */
export type Ticker = "IONQ" | "XE" | "ANTHROPIC";

/** 収集元 */
export type SourceName = "google_news" | "yahoo_finance" | "sec_edgar";

/** 監視銘柄の設定（lib/config/tickers.ts） */
export interface TickerConfig {
  /** 内部識別子 */
  readonly ticker: Ticker;
  /** 正式名称 */
  readonly name: string;
  /** 上場済みか（false の場合は IPO 追跡対象） */
  readonly listed: boolean;
  /** 検索・フィルタに使う関連キーワード */
  readonly keywords: readonly string[];
}

/**
 * Source が返す正規化前の記事。
 * id / summary は pipeline 側で確定させる。
 */
export interface RawArticle {
  readonly ticker: Ticker;
  readonly source: SourceName;
  readonly title: string;
  readonly url: string;
  /** 記事公開日時（ISO8601）。取得不能なら収集時刻で代替。 */
  readonly publishedAt: string;
  /** ソース由来の本文抜粋（要約の素材） */
  readonly excerpt: string;
}

/**
 * 保存・表示に使う正規化済みニュース。
 * id = URL の SHA-256（冪等性キー）。
 */
export interface NewsItem {
  readonly id: string;
  readonly ticker: Ticker;
  readonly title: string;
  readonly url: string;
  readonly source: SourceName;
  readonly publishedAt: string;
  readonly summary: string;
  readonly createdAt: string;
}
