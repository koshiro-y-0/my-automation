import { Client } from "@notionhq/client";
import type { TickerConfig } from "@/lib/types";
import { TICKERS as STATIC_TICKERS } from "./tickers";

/**
 * 監視銘柄の取得・追加。
 * NOTION_TICKERS_DATABASE_ID が設定されていれば Notion 設定DBを正とし、
 * 未設定・取得失敗時は静的な既定リスト（tickers.ts）にフォールバックする。
 *
 * 設定DBのプロパティ:
 *   Ticker(title) / Name(rich_text) / Keywords(rich_text, カンマ区切り)
 *   Listed(checkbox) / YahooSymbol(rich_text) / CIK(rich_text) / Active(checkbox)
 */

const PROP = {
  ticker: "Ticker",
  name: "Name",
  keywords: "Keywords",
  listed: "Listed",
  yahooSymbol: "YahooSymbol",
  cik: "CIK",
  active: "Active",
} as const;

export interface NewTickerInput {
  ticker: string;
  name: string;
  keywords: string[];
  listed: boolean;
  yahooSymbol?: string;
  cik?: string;
}

function configuredClient(): { client: Client; dbId: string } | null {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_TICKERS_DATABASE_ID;
  if (!token || !dbId) return null;
  return { client: new Client({ auth: token }), dbId };
}

async function resolveDataSourceId(client: Client, dbId: string): Promise<string> {
  const db = (await client.databases.retrieve({ database_id: dbId })) as {
    data_sources?: Array<{ id: string }>;
  };
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error(`No data source for tickers DB ${dbId}`);
  return id;
}

/** 監視銘柄の一覧を取得（設定DB優先、失敗時は静的フォールバック）。 */
export async function getTickers(): Promise<readonly TickerConfig[]> {
  const cfg = configuredClient();
  if (!cfg) return STATIC_TICKERS;

  try {
    const dataSourceId = await resolveDataSourceId(cfg.client, cfg.dbId);
    const res = await cfg.client.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
    });
    const tickers = res.results
      .map(pageToTicker)
      .filter((t): t is TickerConfig => t !== null);
    return tickers.length > 0 ? tickers : STATIC_TICKERS;
  } catch {
    return STATIC_TICKERS;
  }
}

/** 設定DBに監視銘柄を追加する（重複ティッカーはスキップ）。 */
export async function addTicker(input: NewTickerInput): Promise<void> {
  const cfg = configuredClient();
  if (!cfg) throw new Error("NOTION_TICKERS_DATABASE_ID is not configured");

  const existing = await getTickers();
  if (existing.some((t) => t.ticker === input.ticker)) {
    throw new Error(`Ticker ${input.ticker} already exists`);
  }

  await cfg.client.pages.create({
    parent: { database_id: cfg.dbId },
    properties: {
      [PROP.ticker]: { title: [{ text: { content: input.ticker } }] },
      [PROP.name]: { rich_text: [{ text: { content: input.name } }] },
      [PROP.keywords]: {
        rich_text: [{ text: { content: input.keywords.join(", ") } }],
      },
      [PROP.listed]: { checkbox: input.listed },
      [PROP.yahooSymbol]: {
        rich_text: input.yahooSymbol
          ? [{ text: { content: input.yahooSymbol } }]
          : [],
      },
      [PROP.cik]: {
        rich_text: input.cik ? [{ text: { content: input.cik } }] : [],
      },
      [PROP.active]: { checkbox: true },
    },
  });
}

// ── ヘルパ ───────────────────────────────────────────────

type AnyPage = { properties?: Record<string, unknown> };

function richText(props: Record<string, unknown>, key: string): string {
  const p = props[key] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  return p?.rich_text?.[0]?.plain_text ?? "";
}

function pageToTicker(page: unknown): TickerConfig | null {
  const props = (page as AnyPage).properties;
  if (!props) return null;

  const active = (props[PROP.active] as { checkbox?: boolean })?.checkbox ?? true;
  if (!active) return null;

  const ticker =
    (props[PROP.ticker] as { title?: Array<{ plain_text?: string }> })?.title?.[0]
      ?.plain_text ?? "";
  if (!ticker) return null;

  const keywords = richText(props, PROP.keywords)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const yahooSymbol = richText(props, PROP.yahooSymbol) || undefined;
  const cik = richText(props, PROP.cik) || undefined;
  const listed = (props[PROP.listed] as { checkbox?: boolean })?.checkbox ?? false;

  return {
    ticker,
    name: richText(props, PROP.name) || ticker,
    listed,
    keywords: keywords.length > 0 ? keywords : [ticker],
    yahooSymbol,
    cik,
  };
}
