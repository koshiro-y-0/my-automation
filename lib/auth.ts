/**
 * 管理操作（企業追加など）の簡易パスワード認証。
 * 単一ユーザー運用向けに、ADMIN_PASSWORD（環境変数）と一致するかだけを判定する。
 * 将来ロール管理が必要になったら、ここを本格的な認証基盤に差し替える。
 */

/** リクエストが管理者（正しいパスワード）かを判定する。 */
export function isAdmin(request: Request): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // 未設定なら一切の管理操作を拒否（安全側）
  const provided = request.headers.get("x-admin-password");
  return Boolean(provided) && safeEqual(provided as string, expected);
}

/** 管理機能が有効か（パスワードが設定されているか）。 */
export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** タイミング攻撃を避けた文字列比較。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
