import { NextResponse } from "next/server";
import { getPicks, isPicksConfigured } from "@/lib/picks/store";

export const runtime = "nodejs";
export const revalidate = 300;

/** AIピックアップ（各企業の注目まとめ）一覧。 */
export async function GET(): Promise<Response> {
  if (!isPicksConfigured()) {
    return NextResponse.json({ configured: false, picks: [] });
  }
  try {
    const picks = await getPicks();
    return NextResponse.json({ configured: true, picks });
  } catch (e) {
    return NextResponse.json({
      configured: false,
      picks: [],
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
