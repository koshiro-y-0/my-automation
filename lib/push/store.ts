import { Client } from "@notionhq/client";
import { createHash } from "node:crypto";
import type { PushRecord } from "./types";

/**
 * プッシュ購読の保存先抽象（設計書 M4）。
 * 既定は Notion 実装。NOTION_PUSH_DATABASE_ID 未設定なら null を返し、
 * プッシュ機能全体が「未設定」として穏当に無効化される。
 */
export interface SubscriptionStore {
  save(record: PushRecord): Promise<void>;
  all(): Promise<PushRecord[]>;
  remove(endpoint: string): Promise<void>;
}

/** エンドポイントの一意キー */
function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

const PROP = {
  endpoint: "Endpoint", // title
  p256dh: "P256dh", // rich_text
  auth: "Auth", // rich_text
  hash: "Hash", // rich_text（重複/削除キー）
} as const;

/** Notion を購読ストアとする実装（ニュースとは別DBを使う）。 */
class NotionSubscriptionStore implements SubscriptionStore {
  private dataSourceId: string | null = null;

  constructor(
    private readonly client: Client,
    private readonly databaseId: string,
  ) {}

  private async resolveDataSourceId(): Promise<string> {
    if (this.dataSourceId) return this.dataSourceId;
    const db = await this.client.databases.retrieve({
      database_id: this.databaseId,
    });
    const id = (db as { data_sources?: Array<{ id: string }> }).data_sources?.[0]
      ?.id;
    if (!id) throw new Error(`No data source for ${this.databaseId}`);
    this.dataSourceId = id;
    return id;
  }

  private async findPageId(endpoint: string): Promise<string | null> {
    const dataSourceId = await this.resolveDataSourceId();
    const res = await this.client.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: PROP.hash,
        rich_text: { equals: endpointHash(endpoint) },
      },
      page_size: 1,
    });
    return res.results[0]?.id ?? null;
  }

  async save(record: PushRecord): Promise<void> {
    if (await this.findPageId(record.endpoint)) return; // 既存はスキップ
    await this.client.pages.create({
      parent: { database_id: this.databaseId },
      properties: {
        [PROP.endpoint]: {
          title: [{ text: { content: record.endpoint.slice(0, 1900) } }],
        },
        [PROP.p256dh]: { rich_text: [{ text: { content: record.p256dh } }] },
        [PROP.auth]: { rich_text: [{ text: { content: record.auth } }] },
        [PROP.hash]: {
          rich_text: [{ text: { content: endpointHash(record.endpoint) } }],
        },
      },
    });
  }

  async all(): Promise<PushRecord[]> {
    const dataSourceId = await this.resolveDataSourceId();
    const res = await this.client.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
    });
    return res.results
      .map((page) => {
        const p = (page as { properties?: Record<string, unknown> }).properties;
        if (!p) return null;
        const endpoint =
          (p[PROP.endpoint] as { title?: Array<{ plain_text?: string }> })
            ?.title?.[0]?.plain_text ?? "";
        const p256dh =
          (p[PROP.p256dh] as { rich_text?: Array<{ plain_text?: string }> })
            ?.rich_text?.[0]?.plain_text ?? "";
        const auth =
          (p[PROP.auth] as { rich_text?: Array<{ plain_text?: string }> })
            ?.rich_text?.[0]?.plain_text ?? "";
        if (!endpoint || !p256dh || !auth) return null;
        return { endpoint, p256dh, auth };
      })
      .filter((x): x is PushRecord => x !== null);
  }

  async remove(endpoint: string): Promise<void> {
    const pageId = await this.findPageId(endpoint);
    if (pageId) {
      // アーカイブ（Notion の論理削除）
      await this.client.pages.update({ page_id: pageId, archived: true });
    }
  }
}

/**
 * 既定の購読ストアを返す。未設定なら null（=プッシュ無効）。
 */
export function getSubscriptionStore(): SubscriptionStore | null {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_PUSH_DATABASE_ID;
  if (!token || !dbId) return null;
  return new NotionSubscriptionStore(new Client({ auth: token }), dbId);
}
