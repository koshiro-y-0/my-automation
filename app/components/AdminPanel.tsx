"use client";

import { useEffect, useState } from "react";

interface FormState {
  ticker: string;
  name: string;
  keywords: string;
  listed: boolean;
  yahooSymbol: string;
  cik: string;
}

const EMPTY: FormState = {
  ticker: "",
  name: "",
  keywords: "",
  listed: true,
  yahooSymbol: "",
  cik: "",
};

export function AdminPanel() {
  const [password, setPassword] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [adminConfigured, setAdminConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/admin/tickers")
      .then((r) => r.json() as Promise<{ adminConfigured: boolean }>)
      .then((d) => setAdminConfigured(d.adminConfigured))
      .catch(() => setAdminConfigured(false));
    // パスワードはこの端末に保持（毎回入力を省く）
    const saved = localStorage.getItem("adminPassword");
    if (saved) setPassword(saved);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/tickers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({
          ticker: form.ticker,
          name: form.name,
          keywords: form.keywords,
          listed: form.listed,
          yahooSymbol: form.yahooSymbol || undefined,
          cik: form.cik || undefined,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (res.ok && data.ok) {
        localStorage.setItem("adminPassword", password);
        setMessage({ ok: true, text: `「${form.ticker}」を追加しました（次回の収集から反映）` });
        setForm(EMPTY);
      } else if (res.status === 401) {
        setMessage({ ok: false, text: "パスワードが違います" });
      } else {
        setMessage({ ok: false, text: data.error ?? "追加に失敗しました" });
      }
    } catch {
      setMessage({ ok: false, text: "通信に失敗しました" });
    } finally {
      setBusy(false);
    }
  }

  if (adminConfigured === false) {
    return (
      <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        管理機能は無効です。Vercel の環境変数に <code>ADMIN_PASSWORD</code> と{" "}
        <code>NOTION_TICKERS_DATABASE_ID</code> を設定すると、ここから企業を追加できます。
      </div>
    );
  }

  const field =
    "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span className="text-neutral-500">管理パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
          autoComplete="current-password"
          required
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-500">ティッカー*（例: NVDA）</span>
          <input
            value={form.ticker}
            onChange={(e) => setForm({ ...form, ticker: e.target.value })}
            className={field}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-500">企業名*</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={field}
            required
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="text-neutral-500">
          関連キーワード（カンマ区切り）
        </span>
        <input
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          className={field}
          placeholder="例: NVIDIA, GPU, AI半導体"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-500">Yahooシンボル（任意）</span>
          <input
            value={form.yahooSymbol}
            onChange={(e) => setForm({ ...form, yahooSymbol: e.target.value })}
            className={field}
            placeholder="例: NVDA"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-500">SEC CIK（任意）</span>
          <input
            value={form.cik}
            onChange={(e) => setForm({ ...form, cik: e.target.value })}
            className={field}
            placeholder="例: 1045810"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.listed}
          onChange={(e) => setForm({ ...form, listed: e.target.checked })}
        />
        <span>上場済み</span>
      </label>

      {message && (
        <p
          className={`text-sm ${message.ok ? "text-teal-600" : "text-red-500"}`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="justify-self-start rounded-md bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
      >
        {busy ? "追加中…" : "企業を追加"}
      </button>
    </form>
  );
}
