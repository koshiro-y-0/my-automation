import type { RawArticle, SourceName, TickerConfig } from "@/lib/types";

/**
 * 情報収集元の共通インターフェース（設計書 §6）。
 * 具体実装（Google News / Yahoo Finance / SEC EDGAR）はこれにのみ依存させ、
 * pipeline からは差し替え可能に保つ。
 */
export interface Source {
  /** 収集元の識別子 */
  readonly name: SourceName;
  /**
   * 指定銘柄の記事を取得する。
   * 失敗時は例外を投げてよい（pipeline 側がソース単位で握る）。
   * その銘柄に非対応なら空配列を返す。
   */
  fetch(ticker: TickerConfig): Promise<RawArticle[]>;
}

/** PWA/サーバーからの収集であることを示す共通 User-Agent（Yahoo/SEC で必須） */
export const USER_AGENT =
  "my-automation/0.1 (+https://github.com/koshiro-y-0/my-automation)";

/** 文字列を安全にトリムし、長すぎる抜粋を抑制する */
export function cleanExcerpt(text: string | undefined, max = 500): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
