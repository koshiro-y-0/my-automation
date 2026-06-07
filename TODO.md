# TODO / WBS — 米国株情報収集・自動化ワークフロー

本書は開発の作業分解（WBS）兼進捗管理表。設計は [`docs/design.md`](docs/design.md)、開発指針は [`CLAUDE.md`](CLAUDE.md) を正とする。
**機能実装（M1〜M4）は全て完了。残りの手動セットアップは [`docs/SETUP.md`](docs/SETUP.md) を参照。**

凡例: `[ ]` 未着手 / `[~]` 進行中 / `[x]` 完了

最終更新: 2026-05-30

---

## マイルストーン

| M | 名称 | 状態 | 内容 |
|---|------|:---:|------|
| M0 | 環境構築・設計 | `[x]` | リポジトリ初期化・設計書・CLAUDE.md |
| M1 | 収集パイプライン（最優先） | `[x]` | RSS/SEC収集 → Notion保存 → Cron。**手動コピペ解消**（実装完了・PR#2 merged） |
| M2 | PWAフロント | `[x]` | 銘柄別一覧UI + ホーム画面追加（実装完了・PR#3 merged） |
| M3 | AI要約 | `[x]` | 非Gemini無料LLM(Groq)で日本語要約（**本番有効化済**・PR#4/#9/#10） |
| M4 | プッシュ通知 | `[x]` | iOS Web Push（iOS16+）（実装完了・PR#5 merged） |
| M5 | 本番化（手動） | `[~]` | **本番稼働中**（S0-S2完了）。https://my-automation-pi.vercel.app ／ 残: S3/S4任意 |

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

## M2. PWAフロント `feat/pwa-frontend`　`[~]`
- [x] `app/api/news/route.ts` — `StorageProvider.list()` 読み出し（キャッシュ300s・未接続を穏当処理）
- [x] `app/page.tsx` — 銘柄別ニュース一覧UI（タブ/フィルタ）
- [x] ニュースカード コンポーネント（タイトル・日付・ソース・概要・リンク）
- [x] `app/manifest.ts` — PWA manifest（名前・アイコン・theme_color）
- [x] `public/icons/` — アプリアイコン一式（192/512/apple-touch）
- [x] `public/sw.js` — Service Worker（オフラインキャッシュ）
- [x] typecheck/build 緑・dev実機で描画/アセット/API確認
- [ ] iPhone でホーム画面追加・表示確認（実Notionデータ投入後）
- [ ] PR作成・マージ

---

## M3. AI要約 `feat/ai-summary`　`[x]`
- [x] LLMプロバイダ選定 → **Groq**（非Gemini・無料枠・OpenAI互換）
- [x] `lib/summarizer/llm.ts` — `LlmSummarizer`（日本語要約、fetchのみ）
- [x] `SUMMARIZER=llm` で切替（factory配線）
- [x] フォールバック（キー未設定/API失敗→Passthrough）を実機検証
- [x] 実 GROQ_API_KEY での要約品質確認（本番で新着がAI日本語要約になることを確認）
- [x] プロンプト堅牢化でハルシネーション抑制（PR#9）
- [x] 要約を新着のみに限定しレート制限フォールバック解消（PR#10）
- [x] PR作成・マージ（PR#4 / #9 / #10）

---

## M4. プッシュ通知 `feat/push-notification`　`[~]`
- [x] VAPID鍵生成（`npm run gen:vapid`）・環境変数整理
- [x] `app/api/push/subscribe/route.ts` — 購読登録（GET公開鍵 / POST保存）
- [x] 購読情報の保存（`SubscriptionStore` 抽象 + Notion別DB実装）
- [x] Service Worker に push / notificationclick ハンドラ追加
- [x] `EnablePushButton` — 許可要求→購読（iOS制約を案内）
- [x] 収集時に新着があれば通知送信（pipeline + `web-push`）
- [x] 未設定時の穏当な無効化を実機検証（GET configured:false / POST 503 / broadcast no-op）
- [x] PR作成・マージ（PR#5）
- [ ] iOS16+ 実機で通知受信確認（→ M5 ステップ4）

---

## M5. 本番化（手動セットアップ）　`[~]`　**本番稼働中** 🚀
> 詳細手順・トラブル早見表は [`docs/SETUP.md`](docs/SETUP.md)。
> 本番URL: https://my-automation-pi.vercel.app

- [x] **S0** ローカル準備（`npm install` / `.env.local` 作成 / `npm run dev` 検証）
- [x] **S1** Notion 準備（コネクト作成・ニュースDB自動作成・接続・実収集338件保存をE2E検証）
- [x] **S2** Vercel デプロイ（インポート・環境変数4件・本番Cron収集9.2秒で完走）
- [x] **S3** AI要約を有効化（Groqキー・`SUMMARIZER=llm`）— 本番で新着がAI日本語要約になることを確認
- [ ] **S4** プッシュ通知を有効化（VAPID鍵・購読DB・iPhoneで許可）⭐任意
- [ ] **S5** 運用・無料枠監視・iPhoneホーム画面追加
