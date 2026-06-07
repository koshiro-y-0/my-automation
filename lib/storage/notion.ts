import { Client } from "@notionhq/client";
import type { NewsItem, SourceName, Ticker } from "@/lib/types";
import type {
  ListOptions,
  SaveResult,
  StorageProvider,
} from "./provider";

/**
 * Notion DB のプロパティ名（設計書 §4 の対応表）。
 * Notion 側のDBはこの名前/型で用意する。
 */
const PROP = {
  title: "Title", // title
  ticker: "Ticker", // select
  url: "URL", // url
  source: "Source", // select
  publishedAt: "PublishedAt", // date
  summary: "Summary", // rich_text
  relevance: "Relevance", // number（関連度 1〜5）
  importance: "Importance", // number（重要度 1〜5）
  hash: "Hash", // rich_text（id・重複チェック用）
} as const;

/**
 * Notion をデータストアとする StorageProvider 実装。
 *
 * 注意（SDK v5）: データベースのクエリは廃止され、配下の「データソース」に対して
 * dataSources.query を呼ぶ。data_source_id は databases.retrieve から解決する。
 * ページ作成は parent: { database_id } で引き続き可能。
 */
export class NotionStorage implements StorageProvider {
  private readonly client: Client;
  private readonly databaseId: string;
  private dataSourceId: string | null = null;

  constructor(token = process.env.NOTION_TOKEN, databaseId = process.env.NOTION_DATABASE_ID) {
    if (!token) throw new Error("NOTION_TOKEN is not set");
    if (!databaseId) throw new Error("NOTION_DATABASE_ID is not set");
    this.client = new Client({ auth: token });
    this.databaseId = databaseId;
  }

  /** データベース配下の主データソースIDを解決（クエリに必須）。1回だけ取得してキャッシュ。 */
  private async resolveDataSourceId(): Promise<string> {
    if (this.dataSourceId) return this.dataSourceId;
    const db = await this.client.databases.retrieve({
      database_id: this.databaseId,
    });
    const sources = (db as { data_sources?: Array<{ id: string }> }).data_sources;
    const id = sources?.[0]?.id;
    if (!id) {
      throw new Error(
        `No data source found for database ${this.databaseId}`,
      );
    }
    this.dataSourceId = id;
    return id;
  }

  async existingIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const dataSourceId = await this.resolveDataSourceId();
    const found = new Set<string>();

    // Notion の filter は OR を多数連結できる。レート制限に配慮し小バッチで照会。
    const BATCH = 100;
    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH);
      const res = await this.client.dataSources.query({
        data_source_id: dataSourceId,
        filter: {
          or: slice.map((id) => ({
            property: PROP.hash,
            rich_text: { equals: id },
          })),
        },
        page_size: BATCH,
      });
      for (const page of res.results) {
        const hash = readRichText(page, PROP.hash);
        if (hash) found.add(hash);
      }
    }
    return found;
  }

  async saveMany(items: NewsItem[]): Promise<SaveResult> {
    if (items.length === 0) return { saved: 0, skipped: 0 };

    const existing = await this.existingIds(items.map((i) => i.id));
    const fresh = items.filter((i) => !existing.has(i.id));

    let saved = 0;
    for (const item of fresh) {
      await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties: {
          [PROP.title]: { title: [{ text: { content: item.title } }] },
          [PROP.ticker]: { select: { name: item.ticker } },
          [PROP.url]: { url: item.url },
          [PROP.source]: { select: { name: item.source } },
          [PROP.publishedAt]: { date: { start: item.publishedAt } },
          [PROP.summary]: {
            rich_text: [{ text: { content: truncate(item.summary, 1900) } }],
          },
          [PROP.relevance]: { number: item.relevance },
          [PROP.importance]: { number: item.importance },
          [PROP.hash]: { rich_text: [{ text: { content: item.id } }] },
        },
      });
      saved++;
    }

    return { saved, skipped: items.length - saved };
  }

  async list(opts: ListOptions = {}): Promise<NewsItem[]> {
    const dataSourceId = await this.resolveDataSourceId();
    const res = await this.client.dataSources.query({
      data_source_id: dataSourceId,
      filter: opts.ticker
        ? { property: PROP.ticker, select: { equals: opts.ticker } }
        : undefined,
      sorts: [{ property: PROP.publishedAt, direction: "descending" }],
      page_size: Math.min(opts.limit ?? 50, 100),
    });

    return res.results.map(pageToNewsItem).filter((x): x is NewsItem => x !== null);
  }
}

// ── Notion ページ ⇄ NewsItem の変換ヘルパ ────────────────────

type AnyPage = { properties?: Record<string, unknown> };

function readRichText(page: unknown, prop: string): string | null {
  const p = (page as AnyPage).properties?.[prop] as
    | { rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  return p?.rich_text?.[0]?.plain_text ?? null;
}

function pageToNewsItem(page: unknown): NewsItem | null {
  const props = (page as AnyPage).properties;
  if (!props) return null;

  const title =
    (props[PROP.title] as { title?: Array<{ plain_text?: string }> })?.title?.[0]
      ?.plain_text ?? "(無題)";
  const url = (props[PROP.url] as { url?: string })?.url ?? "";
  const ticker = (props[PROP.ticker] as { select?: { name?: string } })?.select
    ?.name as Ticker | undefined;
  const source = (props[PROP.source] as { select?: { name?: string } })?.select
    ?.name as SourceName | undefined;
  const publishedAt =
    (props[PROP.publishedAt] as { date?: { start?: string } })?.date?.start ?? "";
  const summary =
    (props[PROP.summary] as { rich_text?: Array<{ plain_text?: string }> })
      ?.rich_text?.[0]?.plain_text ?? "";
  const relevance =
    (props[PROP.relevance] as { number?: number | null })?.number ?? 3;
  const importance =
    (props[PROP.importance] as { number?: number | null })?.number ?? 3;
  const id = readRichText(page, PROP.hash) ?? url;

  if (!ticker || !source || !url) return null;

  return {
    id,
    ticker,
    title,
    url,
    source,
    publishedAt,
    summary,
    relevance,
    importance,
    createdAt:
      (page as { created_time?: string }).created_time ?? new Date().toISOString(),
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
