import type { RawArticle, Ticker, TickerConfig } from "@/lib/types";
import type { Source } from "./source";

/**
 * SEC は User-Agent に「連絡先（メール）」を含めることを必須とする。
 * 形式が満たないと 403 で拒否される。環境変数で上書き可能。
 * 参考: https://www.sec.gov/os/webmaster-faq#developers
 */
const SEC_USER_AGENT =
  process.env.SEC_USER_AGENT ?? "my-automation/0.1 (contact: koshiro49@icloud.com)";

/**
 * SEC EDGAR の CIK（ゼロ埋め10桁）。
 * 未上場/CIK不明の銘柄は対象外（SEC開示は存在しないため）。
 */
const CIK: Partial<Record<Ticker, string>> = {
  IONQ: "0001824920",
  // XE: SPAC合併が解消され公開企業ではないため対象外
  // ANTHROPIC: 未上場のため対象外
};

/** 収集対象とする主要な開示フォーム（持株報告 3/4/5 等のノイズは除外） */
const RELEVANT_FORMS = new Set([
  "8-K",
  "10-Q",
  "10-K",
  "6-K",
  "20-F",
  "425",
  "S-1",
  "424B4",
  "DEF 14A",
]);

interface SubmissionsResponse {
  name: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

/**
 * SEC EDGAR の submissions API から決算・開示情報を取得する。
 * data.sec.gov はカスタム User-Agent を必須とする。
 */
export class SecEdgarSource implements Source {
  readonly name = "sec_edgar" as const;

  async fetch(ticker: TickerConfig): Promise<RawArticle[]> {
    const cik = CIK[ticker.ticker];
    if (!cik) return [];

    const res = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      { headers: { "User-Agent": SEC_USER_AGENT }, signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) {
      throw new Error(`SEC EDGAR ${cik} responded ${res.status}`);
    }

    const data = (await res.json()) as SubmissionsResponse;
    const r = data.filings.recent;
    const cikNum = String(Number(cik)); // ゼロ埋めを外す（URL用）
    const out: RawArticle[] = [];

    for (let i = 0; i < r.accessionNumber.length && out.length < 20; i++) {
      const form = r.form[i];
      if (!RELEVANT_FORMS.has(form)) continue;

      const accession = r.accessionNumber[i].replace(/-/g, "");
      const doc = r.primaryDocument[i];
      if (!doc) continue;

      const url = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accession}/${doc}`;
      const desc = r.primaryDocDescription[i] || form;

      out.push({
        ticker: ticker.ticker,
        source: this.name,
        title: `[${form}] ${data.name} — ${desc}`,
        url,
        publishedAt: new Date(`${r.filingDate[i]}T00:00:00Z`).toISOString(),
        excerpt: `SEC filing ${form} filed on ${r.filingDate[i]} by ${data.name}.`,
      });
    }

    return out;
  }
}
