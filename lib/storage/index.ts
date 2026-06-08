import type { StorageProvider } from "./provider";
import { NotionStorage } from "./notion";

export type {
  StorageProvider,
  ListOptions,
  SaveResult,
  SortKey,
  SortDirection,
} from "./provider";

/**
 * 既定の StorageProvider を返すファクトリ。
 * 将来 Postgres 等を追加する場合はここで環境変数を見て切り替える。
 */
export function getStorage(): StorageProvider {
  return new NotionStorage();
}
