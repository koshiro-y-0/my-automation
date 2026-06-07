import type { NewsItem, Ticker } from "@/lib/types";

/** 並び順の種別 */
export type SortKey = "latest" | "relevance" | "importance";

/** 一覧取得のオプション */
export interface ListOptions {
  ticker?: Ticker;
  limit?: number;
  /** 並び順（既定: latest = 公開日時の新しい順） */
  sort?: SortKey;
}

/** 保存結果のサマリ */
export interface SaveResult {
  saved: number;
  skipped: number;
}

/**
 * データストアの抽象（設計書 §6 / 原則: 依存性逆転）。
 * 上位（pipeline / API）はこのインターフェースにのみ依存し、
 * Notion 実装は背後に隠す（将来 Postgres 等へ無改修で差し替え可能）。
 */
export interface StorageProvider {
  /** 与えた id 群のうち、既に保存済みのものを返す（冪等性チェック） */
  existingIds(ids: string[]): Promise<Set<string>>;
  /** 未保存分のみ保存する。重複は skip。 */
  saveMany(items: NewsItem[]): Promise<SaveResult>;
  /** 保存済みニュースを新しい順で取得する（PWA表示用） */
  list(opts?: ListOptions): Promise<NewsItem[]>;
}
