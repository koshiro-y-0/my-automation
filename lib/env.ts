/**
 * 環境変数を取得し、前後の空白（タブ・改行・スペース）を除去する。
 *
 * Vercel 等のダッシュボードに値を貼り付けるとき、先頭にタブ(\t)や末尾に改行が
 * 混入することがある。特に Notion の database_id はそのままだと
 * 「should be a valid uuid」検証エラーになり、ピック保存などが丸ごと失敗していた。
 * 全ての ID/トークン読込をこのヘルパ経由にして再発を防ぐ。
 */
export function env(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}
