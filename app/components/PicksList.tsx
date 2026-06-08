"use client";

import { useEffect, useState } from "react";
import type { Pick } from "@/lib/types";

interface PicksResponse {
  configured: boolean;
  picks: Pick[];
}

function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ダイジェスト本文を行（・始まり）に分割。 */
function toBullets(digest: string): string[] {
  return digest
    .split(/\n+/)
    .map((l) => l.replace(/^[・\-*\s]+/, "").trim())
    .filter(Boolean);
}

export function PicksList() {
  const [data, setData] = useState<PicksResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unconfigured" | "error">(
    "loading",
  );

  useEffect(() => {
    fetch("/api/picks")
      .then((r) => r.json() as Promise<PicksResponse>)
      .then((d) => {
        setData(d);
        setStatus(d.configured ? "ready" : "unconfigured");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") {
    return <p className="py-10 text-center text-sm text-neutral-500">読み込み中…</p>;
  }
  if (status === "unconfigured") {
    return (
      <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        AIピックアップは準備中です。<code>NOTION_PICKS_DATABASE_ID</code> と{" "}
        <code>GROQ_API_KEY</code> を設定し、毎朝の収集が走ると各企業のまとめが表示されます。
      </div>
    );
  }
  if (status === "error") {
    return (
      <p className="py-10 text-center text-sm text-red-500">
        読み込みに失敗しました。時間をおいて再度お試しください。
      </p>
    );
  }

  const picks = data?.picks ?? [];
  if (picks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        まだピックアップがありません。次回の自動収集をお待ちください。
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {picks.map((p) => (
        <section
          key={p.ticker}
          className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">
              {p.name}
              <span className="ml-2 text-xs font-normal text-neutral-400">
                {p.ticker}
              </span>
            </h2>
            <span className="text-xs text-neutral-400">
              {formatDateTime(p.generatedAt)}
            </span>
          </div>

          <ul className="mt-3 grid gap-1.5">
            {toBullets(p.digest).map((b, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-teal-500">•</span>
                <span className="text-neutral-700 dark:text-neutral-200">{b}</span>
              </li>
            ))}
          </ul>

          {p.articles.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-neutral-400">
                参照記事 {p.articles.length}件
              </summary>
              <ul className="mt-2 grid gap-1">
                {p.articles.map((a, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-neutral-500 underline-offset-2 hover:text-teal-600 hover:underline"
                    >
                      ★{a.importance} {a.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
