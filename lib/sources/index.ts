import type { Source } from "./source";
import { GoogleNewsSource } from "./google-news";
import { YahooFinanceSource } from "./yahoo-finance";
import { SecEdgarSource } from "./sec-edgar";

export type { Source } from "./source";

/** 有効な収集元の一覧。ここに追加すれば pipeline が自動的に利用する。 */
export function getSources(): Source[] {
  return [
    new GoogleNewsSource(),
    new YahooFinanceSource(),
    new SecEdgarSource(),
  ];
}
