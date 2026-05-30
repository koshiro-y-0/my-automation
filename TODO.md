# TODO / WBS — 米国株情報収集・自動化ワークフロー

本書は開発の作業分解（WBS）兼進捗管理表。設計は [`docs/design.md`](docs/design.md)、開発指針は [`CLAUDE.md`](CLAUDE.md) を正とする。

凡例: `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了

最終更新: 2026-05-30

---

## マイルストーン

| M | 名称 | 状態 | 内容 |
|---|------|:---:|------|
| M0 | 環境構築・設計 | `[x]` | リポジトリ初期化・設計書・CLAUDE.md |
| M1 | 収集パイプライン（最優先） | `[~]` | RSS/SEC収集 → Notion保存 → Cron。**手動コピペ解消**（コア実装完了・実Notion検証待ち） |
| M2 | PWAフロント | `[ ]` | 銘柄別一覧UI + ホーム画面追加 |
| M3 | AI要約 | `[ ]` | 非Gemini無料LLMで日本語要約 |
| M4 | プッシュ通知 | `[ ]` | iOS Web Push（iOS16+） |

---

## M0. 環境構築・設計　`[x]`
- [x] 計画書(`automation_plan.docx`)読み込み・質疑応答
- [x] システム設計書 `docs/design.md` 作成
- [x] Next.js 15 雛形生成・ビルド検証
- [x] Git初期化・初回コミット・GitHub Push
- [x] `CLAUDE.md` 作成・PR・マージ

---

## M1. 収集パイプライン `feat/collection-pipeline`　`[~]`　★最優先

### 1-1. 基盤
- [x] `lib/types.ts` — `Ticker` / `NewsItem` / `RawArticle` / `source` 型
- [x] `lib/config/tickers.ts` — 監視銘柄（IONQ / XE / ANTHROPIC）とキーワード
- [x] `lib/hash.ts` — URL→SHA-256（冪等性キー）

### 1-2. Source層（インターフェース駆動）
- [x] `lib/sources/source.ts` — `Source` インターフェース
- [x] `lib/sources/google-news.ts` — Google News RSS
- [x] `lib/sources/yahoo-finance.ts` — Yahoo Finance RSS（IONQ/XE、UA必須）
- [x] `lib/sources/sec-edgar.ts` — SEC EDGAR submissions API（CIKベース、UA要件対応）
- [x] `lib/sources/index.ts` — Source 登録

### 1-3. Storage層（抽象化）
- [x] `lib/storage/provider.ts` — `StorageProvider` インターフェース
- [x] `lib/storage/notion.ts` — Notion 実装（SDK v5 dataSources.query 対応）
- [x] `lib/storage/index.ts` — Provider ファクトリ

### 1-4. Summarizer層（抽象化 / MVPはPassthrough）
- [x] `lib/summarizer/summarizer.ts` — `Summarizer` インターフェース
- [x] `lib/summarizer/passthrough.ts` — RSS抜粋をそのまま返す
- [x] `lib/summarizer/index.ts` — `SUMMARIZER` 環境変数で選択

### 1-5. オーケストレーション & エンドポイント
- [x] `lib/pipeline.ts` — `collect()`: 取得→正規化→重複排除→要約→保存
- [x] `app/api/cron/collect/route.ts` — Cronトリガ（`CRON_SECRET` で認可）
- [x] `vercel.json` — 毎朝1回の cron 定義

### 1-6. 検証
- [x] `npm run typecheck` / `npm run build` 緑
- [x] 実機 dry-run：GoogleNews/Yahoo/SEC 全ソース疎通確認（318件取得）
- [ ] 実Notion接続での保存確認（要 NOTION_TOKEN / DATABASE_ID）
- [ ] PR作成・レビュー・マージ

---

## M2. PWAフロント `feat/pwa-frontend`　`[ ]`
- [ ] `app/api/news/route.ts` — `StorageProvider.list()` 読み出し（キャッシュ）
- [ ] `app/page.tsx` — 銘柄別ニュース一覧UI（タブ/フィルタ）
- [ ] ニュースカード コンポーネント（タイトル・日付・ソース・概要・リンク）
- [ ] `app/manifest.ts` — PWA manifest（名前・アイコン・theme_color）
- [ ] `public/icons/` — アプリアイコン一式
- [ ] `public/sw.js` — Service Worker（オフラインキャッシュ）
- [ ] iPhone でホーム画面追加・表示確認
- [ ] PR作成・マージ

---

## M3. AI要約 `feat/ai-summary`　`[ ]`
- [ ] LLMプロバイダ選定（Groq 等・非Gemini無料枠）
- [ ] `lib/summarizer/llm.ts` — `LlmSummarizer`（日本語要約）
- [ ] `SUMMARIZER=llm` で切替動作確認
- [ ] レート/無料枠の監視・フォールバック（失敗時はPassthrough）
- [ ] PR作成・マージ

---

## M4. プッシュ通知 `feat/push-notification`　`[ ]`
- [ ] VAPID鍵生成・環境変数設定
- [ ] `app/api/push/subscribe/route.ts` — 購読登録
- [ ] 購読情報の保存（StorageProvider拡張）
- [ ] Service Worker に push イベントハンドラ追加
- [ ] 収集時に新着があれば通知送信（`web-push`）
- [ ] iOS16+ 実機で通知受信確認
- [ ] PR作成・マージ

---

## 横断 / 運用
- [ ] Vercel へデプロイ（無料プラン）・環境変数設定
- [ ] Notion Integration 作成・DBプロパティ整備
- [ ] Cron 実行ログ・無料枠使用量の定期確認
- [ ] README 運用手順の更新
