import { Client } from "@notionhq/client";

/**
 * API消費量の記録・取得（機能5）。
 * Groq/Notion/Vercel の当日使用量を Notion（API Usage DB）に1日1行で記録する。
 * Groq は実APIのレート制限ヘッダーで正確に、Notion/Vercel は自前カウント（概算）。
 *
 * NOTION_USAGE_DATABASE_ID 未設定時は記録・取得とも no-op（PWAは「未設定」表示）。
 */

/** 無料枠の上限（環境変数で上書き可。Groqプラン変更等に追従するため）。 */
export const LIMITS = {
  groqRequests: Number(process.env.GROQ_DAILY_REQUESTS) || 1000,
  groqTokens: Number(process.env.GROQ_DAILY_TOKENS) || 100_000,
  notionWrites: Number(process.env.NOTION_DAILY_WRITES_SOFT) || 1000,
  vercelRuns: Number(process.env.VERCEL_DAILY_RUNS_SOFT) || 100,
};

export interface UsageSnapshot {
  date: string; // UTC YYYY-MM-DD
  groqRequests: number;
  groqTokens: number;
  notionWrites: number;
  collectRuns: number;
  groqResetAt: string; // ISO8601 or ""
  groqLimited: boolean;
}

export interface UsageDelta {
  groqRequests?: number;
  groqTokens?: number;
  notionWrites?: number;
  collectRuns?: number;
  groqResetAt?: string;
  groqLimited?: boolean;
}

const PROP = {
  date: "Date",
  groqRequests: "GroqRequests",
  groqTokens: "GroqTokens",
  notionWrites: "NotionWrites",
  collectRuns: "CollectRuns",
  groqResetAt: "GroqResetAt",
  groqLimited: "GroqLimited",
} as const;

export function isUsageConfigured(): boolean {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_USAGE_DATABASE_ID);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function client(): { client: Client; dbId: string } | null {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_USAGE_DATABASE_ID;
  if (!token || !dbId) return null;
  return { client: new Client({ auth: token }), dbId };
}

async function dataSourceId(c: Client, dbId: string): Promise<string> {
  const db = (await c.databases.retrieve({ database_id: dbId })) as {
    data_sources?: Array<{ id: string }>;
  };
  const id = db.data_sources?.[0]?.id;
  if (!id) throw new Error("usage DB data source not found");
  return id;
}

function emptySnapshot(date = todayUtc()): UsageSnapshot {
  return {
    date,
    groqRequests: 0,
    groqTokens: 0,
    notionWrites: 0,
    collectRuns: 0,
    groqResetAt: "",
    groqLimited: false,
  };
}

async function findTodayPage(
  c: Client,
  dsId: string,
  date: string,
): Promise<{ id: string; snap: UsageSnapshot } | null> {
  const res = await c.dataSources.query({
    data_source_id: dsId,
    filter: { property: PROP.date, title: { equals: date } },
    page_size: 1,
  });
  const page = res.results[0] as { id: string; properties?: Record<string, unknown> } | undefined;
  if (!page) return null;
  const p = page.properties ?? {};
  const num = (k: string) => (p[k] as { number?: number | null })?.number ?? 0;
  const rich = (k: string) =>
    (p[k] as { rich_text?: Array<{ plain_text?: string }> })?.rich_text?.[0]
      ?.plain_text ?? "";
  return {
    id: page.id,
    snap: {
      date,
      groqRequests: num(PROP.groqRequests),
      groqTokens: num(PROP.groqTokens),
      notionWrites: num(PROP.notionWrites),
      collectRuns: num(PROP.collectRuns),
      groqResetAt: rich(PROP.groqResetAt),
      groqLimited: (p[PROP.groqLimited] as { checkbox?: boolean })?.checkbox ?? false,
    },
  };
}

/** 当日の使用量スナップショットを取得（未設定・無記録なら空）。 */
export async function getUsage(): Promise<UsageSnapshot> {
  const cfg = client();
  if (!cfg) return emptySnapshot();
  try {
    const dsId = await dataSourceId(cfg.client, cfg.dbId);
    const found = await findTodayPage(cfg.client, dsId, todayUtc());
    return found?.snap ?? emptySnapshot();
  } catch {
    return emptySnapshot();
  }
}

/** 当日の使用量に差分を加算（行が無ければ作成）。失敗は握りつぶす（計測は本処理を止めない）。 */
export async function addUsage(delta: UsageDelta): Promise<void> {
  const cfg = client();
  if (!cfg) return;
  try {
    const date = todayUtc();
    const dsId = await dataSourceId(cfg.client, cfg.dbId);
    const found = await findTodayPage(cfg.client, dsId, date);
    const base = found?.snap ?? emptySnapshot(date);

    const next: UsageSnapshot = {
      date,
      groqRequests: base.groqRequests + (delta.groqRequests ?? 0),
      groqTokens: base.groqTokens + (delta.groqTokens ?? 0),
      notionWrites: base.notionWrites + (delta.notionWrites ?? 0),
      collectRuns: base.collectRuns + (delta.collectRuns ?? 0),
      groqResetAt: delta.groqResetAt ?? base.groqResetAt,
      groqLimited: delta.groqLimited ?? base.groqLimited,
    };

    const props = {
      [PROP.groqRequests]: { number: next.groqRequests },
      [PROP.groqTokens]: { number: next.groqTokens },
      [PROP.notionWrites]: { number: next.notionWrites },
      [PROP.collectRuns]: { number: next.collectRuns },
      [PROP.groqResetAt]: {
        rich_text: next.groqResetAt
          ? [{ text: { content: next.groqResetAt } }]
          : [],
      },
      [PROP.groqLimited]: { checkbox: next.groqLimited },
    };

    if (found) {
      await cfg.client.pages.update({ page_id: found.id, properties: props });
    } else {
      await cfg.client.pages.create({
        parent: { database_id: cfg.dbId },
        properties: {
          [PROP.date]: { title: [{ text: { content: date } }] },
          ...props,
        },
      });
    }
  } catch {
    // 計測の失敗は無視
  }
}

/**
 * Groqがロック中か。
 * - 429検知時のロックは resetAt まで【限定】。Groqの429は多くが「分次」レート制限で
 *   数分で回復するため、日内ずっとロックし続けない（resetAt無し/経過後は解除）。
 *   ※以前は limited=true だけで当日ロック扱いになり、収集直後のピック生成が
 *     毎日スキップされる不具合の原因だった。
 * - 日次の上限はリクエスト数で判定する。
 */
export function isGroqLocked(snap: UsageSnapshot): boolean {
  if (snap.groqLimited && snap.groqResetAt) {
    if (new Date(snap.groqResetAt).getTime() > Date.now()) return true;
  }
  return snap.groqRequests >= LIMITS.groqRequests;
}
