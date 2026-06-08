import { Client } from "@notionhq/client";
import type { Pick } from "@/lib/types";

/**
 * AIピックアップ（企業ごとの注目まとめ）の保存・取得。
 * Notion「Picks」DBに1企業=1行で最新ダイジェストを保持（upsert）。
 * NOTION_PICKS_DATABASE_ID 未設定時は no-op / 空。
 */

const PROP = {
  ticker: "Ticker", // title
  date: "Date", // rich_text (UTC日付)
  digest: "Digest", // rich_text
  articles: "Articles", // rich_text (JSON)
  generatedAt: "GeneratedAt", // date
} as const;

export function isPicksConfigured(): boolean {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_PICKS_DATABASE_ID);
}

function cfg(): { client: Client; dbId: string } | null {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_PICKS_DATABASE_ID;
  if (!token || !dbId) return null;
  return { client: new Client({ auth: token }), dbId };
}

async function dataSourceId(c: Client, dbId: string): Promise<string> {
  const db = (await c.databases.retrieve({ database_id: dbId })) as {
    data_sources?: Array<{ id: string }>;
  };
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error("picks DB data source not found");
  return id;
}

/** 企業ごとの最新ピックを取得（生成日時の新しい順）。 */
export async function getPicks(): Promise<Pick[]> {
  const c = cfg();
  if (!c) return [];
  try {
    const dsId = await dataSourceId(c.client, c.dbId);
    const res = await c.client.dataSources.query({
      data_source_id: dsId,
      sorts: [{ property: PROP.generatedAt, direction: "descending" }],
      page_size: 50,
    });
    return res.results
      .map(pageToPick)
      .filter((p): p is Pick => p !== null);
  } catch {
    return [];
  }
}

/** 1企業ぶんのピックを保存（既存行があれば更新）。 */
export async function savePick(pick: Pick): Promise<void> {
  const c = cfg();
  if (!c) return;
  const dsId = await dataSourceId(c.client, c.dbId);

  const existing = await c.client.dataSources.query({
    data_source_id: dsId,
    filter: { property: PROP.ticker, title: { equals: pick.ticker } },
    page_size: 1,
  });

  const props = {
    [PROP.date]: {
      rich_text: [{ text: { content: pick.generatedAt.slice(0, 10) } }],
    },
    [PROP.digest]: {
      rich_text: [{ text: { content: pick.digest.slice(0, 1900) } }],
    },
    [PROP.articles]: {
      rich_text: [{ text: { content: fitArticlesJson(pick.articles) } }],
    },
    [PROP.generatedAt]: { date: { start: pick.generatedAt } },
  };

  const page = existing.results[0] as { id: string } | undefined;
  if (page) {
    await c.client.pages.update({ page_id: page.id, properties: props });
  } else {
    await c.client.pages.create({
      parent: { database_id: c.dbId },
      properties: {
        [PROP.ticker]: { title: [{ text: { content: pick.ticker } }] },
        ...props,
      },
    });
  }
}

// ── ヘルパ ───────────────────────────────────────────────

/**
 * 記事配列を Notion rich_text の上限(2000字)に収まる JSON にする。
 * タイトルを短縮し、それでも超えるなら末尾の記事から削って必ず有効なJSONを返す。
 */
function fitArticlesJson(
  articles: Pick["articles"],
  max = 1900,
): string {
  let arr = articles.map((a) => ({
    title: a.title.slice(0, 90),
    url: a.url,
    importance: a.importance,
  }));
  let json = JSON.stringify(arr);
  while (json.length > max && arr.length > 0) {
    arr = arr.slice(0, -1);
    json = JSON.stringify(arr);
  }
  return json;
}

function pageToPick(page: unknown): Pick | null {
  const props = (page as { properties?: Record<string, unknown> }).properties;
  if (!props) return null;
  const ticker =
    (props[PROP.ticker] as { title?: Array<{ plain_text?: string }> })?.title?.[0]
      ?.plain_text ?? "";
  if (!ticker) return null;
  const digest =
    (props[PROP.digest] as { rich_text?: Array<{ plain_text?: string }> })
      ?.rich_text?.[0]?.plain_text ?? "";
  const articlesRaw =
    (props[PROP.articles] as { rich_text?: Array<{ plain_text?: string }> })
      ?.rich_text?.[0]?.plain_text ?? "[]";
  const generatedAt =
    (props[PROP.generatedAt] as { date?: { start?: string } })?.date?.start ?? "";

  let articles: Pick["articles"] = [];
  try {
    const parsed = JSON.parse(articlesRaw);
    if (Array.isArray(parsed)) articles = parsed;
  } catch {
    articles = [];
  }

  return { ticker, name: ticker, digest, articles, generatedAt };
}
