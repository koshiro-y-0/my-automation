/**
 * コアドメイン型。設計書 docs/design.md §4 / §6 に対応。
 */

/**
 * 監視銘柄の識別子。
 * 当初は IONQ/XE/ANTHROPIC 固定だったが、企業を動的に追加できるよう string に拡張。
 * 既定3銘柄は lib/config/tickers.ts、追加分は Notion 設定DB（ticker-store）で管理。
 */
export type Ticker = string;

/** 収集元 */
export type SourceName = "google_news" | "yahoo_finance" | "sec_edgar";

/** 監視銘柄の設定（lib/config/tickers.ts / Notion 設定DB） */
export interface TickerConfig {
  /** 内部識別子（例: IONQ）。Notion の Ticker セレクト値にもなる。 */
  readonly ticker: Ticker;
  /** 正式名称 */
  readonly name: string;
  /** 上場済みか（false の場合は IPO 追跡対象） */
  readonly listed: boolean;
  /** 検索・フィルタに使う関連キーワード */
  readonly keywords: readonly string[];
  /** Yahoo Finance のシンボル（未上場・未設定なら Yahoo ソースは対象外） */
  readonly yahooSymbol?: string;
  /** SEC EDGAR の CIK（ゼロ埋め10桁。未設定なら SEC ソースは対象外） */
  readonly cik?: string;
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
  /** 日本語タイトル（英語記事はAIが翻訳。無い場合は空文字）。 */
  readonly titleJa: string;
  readonly url: string;
  readonly source: SourceName;
  readonly publishedAt: string;
  readonly summary: string;
  /** 関連度（銘柄・テーマへの関連性）1〜5。未採点は 3（中立）。 */
  readonly relevance: number;
  /** 重要度（市場・投資判断へのインパクト）1〜5。未採点は 3（中立）。 */
  readonly importance: number;
  /** AI（LLM）で要約・採点・翻訳済みか。AI要約専用ページの抽出に使う。 */
  readonly enriched: boolean;
  readonly createdAt: string;
}

/** AIピックアップ（企業ごとの注目記事まとめ）。 */
export interface Pick {
  readonly ticker: Ticker;
  readonly name: string;
  /** AIが集約したダイジェスト本文（箇条書き等）。 */
  readonly digest: string;
  /** 集約対象に選ばれた記事 */
  readonly articles: Array<{ title: string; url: string; importance: number }>;
  /** 生成日時（ISO8601） */
  readonly generatedAt: string;
}
