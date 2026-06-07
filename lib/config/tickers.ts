import type { TickerConfig } from "@/lib/types";

/**
 * 既定の監視銘柄（設計書 docs/design.md §5）。
 * 企業の動的追加は Notion 設定DB（lib/config/ticker-store.ts）で行い、
 * 設定DB未構成時はこの静的リストにフォールバックする。
 */
export const TICKERS: readonly TickerConfig[] = [
  {
    ticker: "IONQ",
    name: "IonQ",
    listed: true,
    keywords: [
      "IonQ",
      "量子コンピュータ",
      "quantum computing",
      "IBM quantum",
      "Google quantum",
    ],
    yahooSymbol: "IONQ",
    cik: "0001824920",
  },
  {
    ticker: "XE",
    name: "X-energy",
    listed: true,
    keywords: [
      "X-energy",
      "小型原子炉",
      "SMR",
      "small modular reactor",
      "エネルギー政策",
    ],
    yahooSymbol: "XE",
  },
  {
    ticker: "ANTHROPIC",
    name: "Anthropic",
    listed: false,
    keywords: [
      "Anthropic",
      "AI規制",
      "AI regulation",
      "OpenAI",
      "資金調達",
      "funding",
      "IPO",
    ],
  },
] as const;

/** ティッカーから設定を引く（見つからなければ undefined） */
export function getTickerConfig(
  ticker: string,
): TickerConfig | undefined {
  return TICKERS.find((t) => t.ticker === ticker);
}
