/** ブラウザの PushSubscription をサーバ保存用に正規化したもの。 */
export interface PushRecord {
  /** プッシュサービスのエンドポイントURL（購読の一意キー） */
  endpoint: string;
  /** 公開鍵（p256dh） */
  p256dh: string;
  /** 認証シークレット（auth） */
  auth: string;
}

/** 通知ペイロード */
export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}
