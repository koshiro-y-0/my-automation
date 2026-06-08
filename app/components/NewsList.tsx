"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { NewsCard } from "./NewsCard";

const SORTS = [
  { key: "latest", label: "最新順" },
  { key: "relevance", label: "関連度順" },
  { key: "importance", label: "重要順" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];
type Direction = "asc" | "desc";

const PAGE = 10; // 1度に表示する件数
const FETCH_LIMIT = 60; // サーバーから取得する上限

interface TabItem {
  key: string;
  label: string;
}

interface NewsResponse {
  configured: boolean;
  items: NewsItem[];
  message?: string;
}

const ALL_TAB: TabItem = { key: "ALL", label: "すべて" };

export function NewsList({ enrichedOnly = false }: { enrichedOnly?: boolean } = {}) {
  const [tabs, setTabs] = useState<TabItem[]>([ALL_TAB]);
  const [tab, setTab] = useState<string>("ALL");
  const [sort, setSort] = useState<SortKey>("latest");
  const [dir, setDir] = useState<Direction>("desc");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [visible, setVisible] = useState(PAGE);
  const [status, setStatus] = useState<"loading" | "ready" | "unconfigured" | "error">(
    "loading",
  );

  // 監視銘柄を取得してタブを構築（動的に追加された企業も反映）
  useEffect(() => {
    let cancelled = false;
    fetch("/api/tickers")
      .then((r) => r.json() as Promise<{ tickers: { ticker: string; name: string }[] }>)
      .then((data) => {
        if (cancelled) return;
        const dynamic = (data.tickers ?? []).map((t) => ({
          key: t.ticker,
          label: t.name || t.ticker,
        }));
        setTabs([ALL_TAB, ...dynamic]);
      })
      .catch(() => {
        /* 取得失敗時は「すべて」タブのみ */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setVisible(PAGE); // 条件変更で表示件数をリセット

    const params = new URLSearchParams();
    if (tab !== "ALL") params.set("ticker", tab);
    if (sort !== "latest") params.set("sort", sort);
    if (dir !== "desc") params.set("dir", dir);
    if (enrichedOnly) params.set("enriched", "1");
    params.set("limit", String(FETCH_LIMIT));
    const qs = params.toString();

    fetch(`/api/news?${qs}`)
      .then((r) => r.json() as Promise<NewsResponse>)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setStatus(data.configured ? "ready" : "unconfigured");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [tab, sort, dir, enrichedOnly]);

  // ソートボタン押下: 同じソートなら方向反転、違うソートなら降順から
  function onSort(key: SortKey) {
    if (key === sort) {
      setDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setDir("desc");
    }
  }

  const shown = items.slice(0, visible);
  const hasMore = items.length > visible;

  return (
    <div>
      {/* 銘柄タブ */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-teal-500 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 並び替え（同じ項目を再クリックで昇順/降順を切替） */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-neutral-400">並び替え</span>
        <div className="flex gap-1">
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={active}
                onClick={() => onSort(s.key)}
                title={active ? (dir === "desc" ? "降順（再クリックで昇順）" : "昇順（再クリックで降順）") : undefined}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                }`}
              >
                {s.label}
                {active && <span className="ml-1">{dir === "desc" ? "▼" : "▲"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        {status === "loading" && (
          <p className="py-10 text-center text-sm text-neutral-500">読み込み中…</p>
        )}

        {status === "unconfigured" && (
          <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            🔌 Notion 未接続です。<code>NOTION_TOKEN</code> と{" "}
            <code>NOTION_DATABASE_ID</code> を設定し、収集パイプライン（
            <code>/api/cron/collect</code>）を実行するとニュースが表示されます。
          </div>
        )}

        {status === "error" && (
          <p className="py-10 text-center text-sm text-red-500">
            読み込みに失敗しました。時間をおいて再度お試しください。
          </p>
        )}

        {status === "ready" && items.length === 0 && (
          <p className="py-10 text-center text-sm text-neutral-500">
            まだニュースがありません。収集パイプラインの初回実行をお待ちください。
          </p>
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <div className="grid gap-3">
              {shown.map((item) => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE)}
                  className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-600 transition hover:border-teal-400 hover:text-teal-600 dark:border-neutral-700 dark:text-neutral-300"
                >
                  さらに表示（残り{items.length - visible}件）
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
