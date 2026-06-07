import type { NewsItem, SourceName } from "@/lib/types";

const SOURCE_LABEL: Record<SourceName, string> = {
  google_news: "Google News",
  yahoo_finance: "Yahoo Finance",
  sec_edgar: "SEC EDGAR",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** 1〜5 の評価を★で表示する小コンポーネント。 */
function Stars({ label, value }: { label: string; value: number }) {
  const v = Math.min(5, Math.max(0, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-1" title={`${label} ${v}/5`}>
      <span className="text-[10px] text-neutral-400">{label}</span>
      <span className="text-amber-500" aria-hidden>
        {"★".repeat(v)}
        <span className="text-neutral-300 dark:text-neutral-600">
          {"★".repeat(5 - v)}
        </span>
      </span>
    </span>
  );
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-teal-400 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-teal-500"
    >
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {item.ticker}
        </span>
        <span>{SOURCE_LABEL[item.source]}</span>
        {item.publishedAt && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
          </>
        )}
      </div>
      <h3 className="mt-2 font-semibold leading-snug">
        {item.titleJa || item.title}
      </h3>
      {item.titleJa && item.titleJa !== item.title && (
        <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">{item.title}</p>
      )}
      {item.summary && (
        <p className="mt-1 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
          {item.summary}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Stars label="関連" value={item.relevance} />
        <Stars label="重要" value={item.importance} />
      </div>
    </a>
  );
}
