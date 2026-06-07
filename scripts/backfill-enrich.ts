/**
 * バックフィル: 既存のNotion記事をAI（Groq）で再エンリッチする一度きりのスクリプト。
 *   要約(JA) / 日本語タイトル / 関連度 / 重要度 を生成し、Enriched=true を立てる。
 *
 * 特徴:
 * - 冪等・再開可能: Enriched=true は再処理しない。途中で止めても再実行で続きから。
 * - レート制限対応: 各記事の間に待機。Groqが429を返したら getSummarizer 内部で
 *   Passthrough にフォールバック(enriched=false)するため、その記事は今回マークせず、
 *   後日の再実行でリトライされる。
 *
 * 実行: npm run backfill            （.env.local を読み込む）
 *       LIMIT=50 npm run backfill   （今回の最大処理件数を制限）
 */
import { readFileSync, existsSync } from "node:fs";

// .env.local を読み込む（CI等で既に環境変数があればそのまま使う）
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.startsWith("#")) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const PROP = {
  title: "Title",
  titleJa: "TitleJa",
  ticker: "Ticker",
  url: "URL",
  source: "Source",
  summary: "Summary",
  relevance: "Relevance",
  importance: "Importance",
  enriched: "Enriched",
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { Client } = await import("@notionhq/client");
  const { getSummarizer } = await import("@/lib/summarizer");
  const summarizer = getSummarizer();

  const client = new Client({ auth: process.env.NOTION_TOKEN });
  const db = (await client.databases.retrieve({
    database_id: process.env.NOTION_DATABASE_ID!,
  })) as { data_sources?: Array<{ id: string }> };
  const dataSourceId = db.data_sources?.[0]?.id;
  if (!dataSourceId) throw new Error("data source not found");

  const limit = Number(process.env.LIMIT) || Infinity;
  const delayMs = Number(process.env.DELAY_MS) || 800;

  let cursor: string | undefined;
  let processed = 0;
  let enrichedCount = 0;
  let skipped = 0;

  outer: do {
    const res: any = await client.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 50,
    });

    for (const page of res.results) {
      if (processed >= limit) break outer;
      const props = page.properties;
      const already = props[PROP.enriched]?.checkbox === true;
      if (already) {
        skipped++;
        continue;
      }

      const title = props[PROP.title]?.title?.[0]?.plain_text ?? "";
      const url = props[PROP.url]?.url ?? "";
      const ticker = props[PROP.ticker]?.select?.name ?? "IONQ";
      const source = props[PROP.source]?.select?.name ?? "google_news";
      const excerpt = props[PROP.summary]?.rich_text?.[0]?.plain_text ?? title;
      if (!url || !title) {
        skipped++;
        continue;
      }

      processed++;
      const e = await summarizer.enrich({
        ticker,
        source,
        title,
        url,
        publishedAt: new Date().toISOString(),
        excerpt,
      } as any);

      if (!e.enriched) {
        // フォールバック（鍵未設定/レート制限）→ マークせず次回再試行
        console.log(`  [skip-llm] ${title.slice(0, 50)} (fallback, will retry)`);
        await sleep(delayMs);
        continue;
      }

      await client.pages.update({
        page_id: page.id,
        properties: {
          [PROP.titleJa]: {
            rich_text: e.titleJa
              ? [{ text: { content: e.titleJa.slice(0, 1900) } }]
              : [],
          },
          [PROP.summary]: {
            rich_text: [{ text: { content: e.summary.slice(0, 1900) } }],
          },
          [PROP.relevance]: { number: e.relevance },
          [PROP.importance]: { number: e.importance },
          [PROP.enriched]: { checkbox: true },
        },
      });
      enrichedCount++;
      console.log(
        `  [ok ${enrichedCount}] ★関連${e.relevance}/重要${e.importance} ${(e.titleJa || title).slice(0, 46)}`,
      );
      await sleep(delayMs);
    }

    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  console.log(
    `\n完了: enriched=${enrichedCount} / 既存skip=${skipped} / 処理試行=${processed}`,
  );
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
