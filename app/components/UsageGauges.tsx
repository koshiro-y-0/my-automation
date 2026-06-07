"use client";

import { useEffect, useState } from "react";

interface Gauge {
  key: string;
  label: string;
  used: number;
  limit: number;
  unit: string;
  locked: boolean;
  resetAt: string | null;
  accurate: boolean;
}

interface UsageResponse {
  configured: boolean;
  groqLocked?: boolean;
  gauges: Gauge[];
}

function formatReset(resetAt: string | null): string {
  if (!resetAt) return "";
  const ms = new Date(resetAt).getTime() - Date.now();
  if (ms <= 0) return "まもなく復帰";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `約${h}時間${m}分後に復帰`;
  return `約${m}分後に復帰`;
}

function barColor(pct: number, locked: boolean): string {
  if (locked || pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  return "bg-teal-500";
}

export function UsageGauges() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json() as Promise<UsageResponse>)
      .then(setData)
      .catch(() => setData({ configured: false, gauges: [] }));
  }, []);

  if (!data || !data.configured || data.gauges.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold">
          API消費量（本日）
          {data.groqLocked && (
            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
              🔒 Groqロック中
            </span>
          )}
        </span>
        <span className="text-xs text-neutral-400">{open ? "閉じる" : "開く"}</span>
      </button>

      {open && (
        <div className="mt-4 grid gap-3">
          {data.gauges.map((g) => {
            const pct = g.limit > 0 ? Math.min(100, (g.used / g.limit) * 100) : 0;
            return (
              <div key={g.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {g.label}
                    {!g.accurate && (
                      <span className="ml-1 text-neutral-400">（概算）</span>
                    )}
                  </span>
                  <span className="tabular-nums text-neutral-500">
                    {g.used.toLocaleString()} / {g.limit.toLocaleString()} {g.unit}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all ${barColor(pct, g.locked)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {g.locked && (
                  <p className="mt-1 text-xs text-red-500">
                    上限到達でロック中。{formatReset(g.resetAt)}（その間はAI要約を停止し、RSS抜粋で継続）
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-neutral-400">
            Groqはレート制限ヘッダー由来で正確。Notion/Vercelはアプリ内カウントの概算です。
          </p>
        </div>
      )}
    </section>
  );
}
