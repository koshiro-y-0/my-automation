import type { TickerConfig } from "@/lib/types";

/**
 * 監視銘柄の定義。設計書 docs/design.md §5。
 * 拡張余地: 無料枠内で最大10銘柄まで（計画書 5-4）。
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
