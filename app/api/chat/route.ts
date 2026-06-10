import { NextResponse } from "next/server";
import { isAdmin, isAdminConfigured } from "@/lib/auth";
import { answerQuestion } from "@/lib/chat/answer";
import { getTickers } from "@/lib/config/ticker-store";
import { getGroqStats, isGroqConfigured, resetGroqStats } from "@/lib/summarizer/llm";
import { addUsage, getUsage, isGroqLocked } from "@/lib/usage/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUESTION_LEN = 300;

/** チャット機能の有効状態（鍵・認証の有無）。値そのものは返さない。 */
export async function GET(): Promise<Response> {
  const usage = await getUsage();
  return NextResponse.json({
    configured: isAdminConfigured() && isGroqConfigured(),
    groqLocked: isGroqLocked(usage),
  });
}

/**
 * チャット回答（v2.0 / 自分専用）。
 * 認可: x-admin-password ヘッダが ADMIN_PASSWORD と一致すること。
 * Groqが日次上限ロック中は 503（無駄打ち・課金リスク回避）。
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAdminConfigured() || !isGroqConfigured()) {
    return NextResponse.json(
      { ok: false, error: "チャットが未設定です（ADMIN_PASSWORD / GROQ_API_KEY）" },
      { status: 503 },
    );
  }
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Groq日次ロック中はAIを呼ばない
  const usage = await getUsage();
  if (isGroqLocked(usage)) {
    return NextResponse.json(
      {
        ok: false,
        groqLocked: true,
        error: "本日のAI利用枠が上限に達しています。リセット後にお試しください。",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const { ticker, question } = parseInput(body) ?? {};
  if (!ticker || !question) {
    return NextResponse.json(
      { ok: false, error: "ticker と question は必須です（質問は300字以内）" },
      { status: 400 },
    );
  }

  // 銘柄の実在確認（設定DB/静的リスト）
  const tickers = await getTickers();
  const config = tickers.find((t) => t.ticker === ticker);
  if (!config) {
    return NextResponse.json(
      { ok: false, error: `未登録の銘柄です: ${ticker}` },
      { status: 400 },
    );
  }

  try {
    resetGroqStats();
    const result = await answerQuestion(config.ticker, config.name, question);

    // チャット消費を既存ゲージに計上
    const g = getGroqStats();
    await addUsage({
      groqRequests: g.requests,
      groqTokens: g.tokens,
      groqResetAt: g.resetAt || undefined,
      groqLimited: g.limited || undefined,
    });

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          groqLocked: g.limited,
          error: g.limited
            ? "AIのレート上限に達しました。しばらくしてからお試しください。"
            : "回答の生成に失敗しました。もう一度お試しください。",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

function parseInput(
  body: unknown,
): { ticker: string; question: string } | null {
  const b = body as { ticker?: unknown; question?: unknown };
  const ticker =
    typeof b?.ticker === "string" && /^[A-Za-z0-9._-]{1,20}$/.test(b.ticker)
      ? b.ticker.toUpperCase()
      : "";
  const question =
    typeof b?.question === "string" ? b.question.trim().slice(0, MAX_QUESTION_LEN) : "";
  if (!ticker || !question) return null;
  return { ticker, question };
}
