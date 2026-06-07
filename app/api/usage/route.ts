import { NextResponse } from "next/server";
import {
  LIMITS,
  getUsage,
  isGroqLocked,
  isUsageConfigured,
} from "@/lib/usage/usage";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * API消費量ゲージ用データ（機能5）。
 * Groq はレート制限ヘッダー由来で正確、Notion/Vercel は自前カウント（概算）。
 */
export async function GET(): Promise<Response> {
  if (!isUsageConfigured()) {
    return NextResponse.json({ configured: false, gauges: [] });
  }

  const u = await getUsage();
  const groqLocked = isGroqLocked(u);

  const gauges = [
    {
      key: "groq",
      label: "Groq（AI要約）",
      used: u.groqRequests,
      limit: LIMITS.groqRequests,
      unit: "リクエスト",
      locked: groqLocked,
      resetAt: u.groqResetAt || null,
      accurate: true,
    },
    {
      key: "groq_tokens",
      label: "Groq トークン",
      used: u.groqTokens,
      limit: LIMITS.groqTokens,
      unit: "トークン",
      locked: false,
      resetAt: u.groqResetAt || null,
      accurate: true,
    },
    {
      key: "notion",
      label: "Notion 書き込み",
      used: u.notionWrites,
      limit: LIMITS.notionWrites,
      unit: "回",
      locked: false,
      resetAt: null,
      accurate: false,
    },
    {
      key: "vercel",
      label: "Vercel 収集実行",
      used: u.collectRuns,
      limit: LIMITS.vercelRuns,
      unit: "回",
      locked: false,
      resetAt: null,
      accurate: false,
    },
  ];

  return NextResponse.json({ configured: true, date: u.date, groqLocked, gauges });
}
