"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatSource } from "@/lib/chat/answer";

/**
 * 企業別AIチャット（v2.0 / 自分専用）。
 * ADMIN_PASSWORD で解錠し、選んだ銘柄について質問する単発Q&A。
 * 会話ログはこの端末のメモリ内のみ（リロードで消える）。
 */

interface TickerOption {
  ticker: string;
  name: string;
}

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: ChatSource[];
}

interface ChatStatus {
  configured: boolean;
  groqLocked: boolean;
}

export function ChatPanel() {
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [tickers, setTickers] = useState<TickerOption[]>([]);
  const [ticker, setTicker] = useState<string>("");
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json() as Promise<ChatStatus>)
      .then(setStatus)
      .catch(() => setStatus({ configured: false, groqLocked: false }));
    fetch("/api/tickers")
      .then((r) => r.json() as Promise<{ tickers: TickerOption[] }>)
      .then((d) => {
        const list = d.tickers ?? [];
        setTickers(list);
        if (list.length > 0) setTicker(list[0].ticker);
      })
      .catch(() => {});
    const saved = localStorage.getItem("adminPassword");
    if (saved) setPassword(saved);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ ticker, question: q }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        answer?: string;
        sources?: ChatSource[];
        error?: string;
        groqLocked?: boolean;
      };

      if (res.ok && data.ok && data.answer) {
        localStorage.setItem("adminPassword", password);
        setMessages((m) => [
          ...m,
          { role: "assistant", text: data.answer!, sources: data.sources },
        ]);
      } else if (res.status === 401) {
        setError("パスワードが違います");
        setMessages((m) => m.slice(0, -1)); // 送信した質問を戻す
        setQuestion(q);
      } else {
        setError(data.error ?? "回答の取得に失敗しました");
      }
    } catch {
      setError("通信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (status && !status.configured) {
    return (
      <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        チャットは未設定です。<code>ADMIN_PASSWORD</code> と{" "}
        <code>GROQ_API_KEY</code> を設定すると利用できます。
      </div>
    );
  }

  const field =
    "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-neutral-900/70";

  return (
    <div className="flex flex-col gap-4">
      {/* 設定列：銘柄＋パスワード */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className={field}
          aria-label="銘柄を選択"
        >
          {tickers.map((t) => (
            <option key={t.ticker} value={t.ticker}>
              {t.name}（{t.ticker}）
            </option>
          ))}
        </select>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="管理パスワード"
          autoComplete="current-password"
          className={`${field} w-44`}
        />
        {status?.groqLocked && (
          <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-300">
            🔒 本日のAI枠が上限です
          </span>
        )}
      </div>

      {/* 会話ログ */}
      <div className="flex min-h-[40vh] flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-white/10 dark:bg-neutral-900/50 dark:backdrop-blur-sm">
        {messages.length === 0 && (
          <p className="m-auto py-10 text-center text-sm text-neutral-500">
            例：「最近どう？」「決算の数字は？」「IBMとの提携の話あった？」
            <br />
            収集済みニュースだけを根拠に回答し、参照記事を添えます。
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="self-end max-w-[85%]">
              <div className="rounded-2xl rounded-br-sm bg-teal-600 px-4 py-2 text-sm text-white">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="self-start max-w-[90%]">
              <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-800 dark:bg-neutral-800/90 dark:text-neutral-100">
                {m.text}
              </div>
              {m.sources && m.sources.length > 0 && (
                <details className="mt-1 px-1">
                  <summary className="cursor-pointer text-xs text-neutral-400">
                    参照記事 {m.sources.length}件
                  </summary>
                  <ul className="mt-1 grid gap-1">
                    {m.sources.map((s, j) => (
                      <li key={j} className="text-xs">
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-neutral-400 underline-offset-2 hover:text-teal-400 hover:underline"
                        >
                          [{j + 1}] ★{s.importance} {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="self-start rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3 text-sm text-neutral-400 dark:bg-neutral-800/90">
            考え中… 🚀
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* 入力 */}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={`${tickers.find((t) => t.ticker === ticker)?.name ?? ""} について質問…`}
          maxLength={300}
          className={`${field} min-w-0 flex-1`}
        />
        <button
          type="submit"
          disabled={busy || !question.trim() || !password}
          className="rounded-md bg-teal-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-600 disabled:opacity-50"
        >
          送信
        </button>
      </form>
    </div>
  );
}
