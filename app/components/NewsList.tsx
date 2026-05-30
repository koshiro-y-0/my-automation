"use client";

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/types";
import { NewsCard } from "./NewsCard";

const TABS = [
  { key: "ALL", label: "すべて" },
  { key: "IONQ", label: "IONQ" },
  { key: "XE", label: "X-energy" },
  { key: "ANTHROPIC", label: "Anthropic" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface NewsResponse {
  configured: boolean;
  items: NewsItem[];
  message?: string;
}

export function NewsList() {
  const [tab, setTab] = useState<TabKey>("ALL");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unconfigured" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    const qs = tab === "ALL" ? "" : `?ticker=${tab}`;

    fetch(`/api/news${qs}`)
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
  }, [tab]);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {TABS.map((t) => (
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
          <div className="grid gap-3">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
