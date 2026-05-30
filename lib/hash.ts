import { createHash } from "node:crypto";

/**
 * URL から決定的な ID を生成する（重複排除・冪等性キー）。
 * 同一URLは常に同一IDになり、収集を何度実行しても重複保存されない。
 */
export function urlToId(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

/**
 * 追跡パラメータ等の揺らぎを除いてURLを正規化する。
 * 同じ記事が別クエリで来ても同一IDに寄せるため。
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const stripPrefixes = ["utm_", "fbclid", "gclid"];
    for (const key of [...u.searchParams.keys()]) {
      if (stripPrefixes.some((p) => key.toLowerCase().startsWith(p))) {
        u.searchParams.delete(key);
      }
    }
    u.hash = "";
    return u.toString();
  } catch {
    // URLとしてパースできない場合はそのまま使う
    return url.trim();
  }
}
