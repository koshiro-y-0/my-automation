# CLAUDE.md

このファイルは、本リポジトリで AI（Claude Code 等）が開発を行う際の**一次指針**です。
コードを書く前に必ず本書と [`docs/design.md`](docs/design.md) を参照してください。

---

## 1. プロジェクト概要

米国株（**IONQ・X-energy・Anthropic**）の情報収集を **完全無料** で自動化し、
iPhone（PWA）で閲覧できるパーソナル・ワークフロー。

- **最優先課題**: 「手動コピペによる情報収集の手間をなくす」
- **絶対制約**: 完全無料で完結（有料プラン・有料API不使用）／法令・利用規約を遵守
- データフロー: `RSS / SEC EDGAR → Vercel Cron（収集） → Notion DB → PWA（Vercel） → iPhone`

詳細な背景は `automation_plan.docx`（元計画書）、技術設計は `docs/design.md` を正とする。

---

## 2. 技術スタック

| 層 | 技術 | 備考 |
|----|------|------|
| フレームワーク | **Next.js 15（App Router）** | Pages Router は使わない |
| 言語 | **TypeScript**（strict） | `any` 原則禁止 |
| UI | **React 19** / **Tailwind CSS v4** | CSSは `app/globals.css` の `@import "tailwindcss"` 方式 |
| 収集 | Route Handler + **Vercel Cron**（`vercel.json`） | Make等の外部GUIは使わない |
| RSS解析 | `rss-parser` | |
| 保存 | **Notion**（`@notionhq/client`）＋ `StorageProvider` 抽象 | 直接Notionを呼ばずProvider経由 |
| 要約 | `Summarizer` 抽象（MVP=Passthrough、後続=非Gemini無料LLM/Groq等） | **Geminiは使わない**（別プロジェクトで採用済のため） |
| 通知 | `web-push`（VAPID, iOS16+） | 後続フェーズ |
| デプロイ | **Vercel 無料プラン** | |

> ⚠️ ライブラリのAPIは頻繁に変わる。Next.js / Notion / Vercel Cron の実装前には公式ドキュメントで最新仕様を確認すること（メモリ任せにしない）。

---

## 3. アーキテクチャ原則

1. **依存性逆転**: 上位ロジックは `Source` / `StorageProvider` / `Summarizer` の**インターフェース**にのみ依存する。具体実装（Notion・各RSS・LLM）は差し替え可能に保つ。
2. **冪等性**: 収集は何度実行しても重複保存しない。`id = URLのSHA-256` を重複排除キーに使う。
3. **無料枠厳守**: 外部呼び出し回数・実行頻度は各サービスの無料枠内。新規の有料依存を**追加しない**。
4. **疎結合な後付け**: AI要約・プッシュ通知は抽象の背後に隠し、MVPを止めずに後から差し込む。

### ディレクトリ構成
```
app/
  layout.tsx, page.tsx, globals.css, manifest.ts
  api/
    cron/collect/route.ts   # 収集パイプライン（Cronトリガ）
    news/route.ts           # PWA向け読み出しAPI
    push/subscribe/route.ts # （後続）購読登録
lib/
  types.ts                  # NewsItem, Ticker など
  config/tickers.ts         # 監視銘柄定義
  sources/                  # Source実装（google-news / yahoo-finance / sec-edgar）
  storage/                  # StorageProvider + notion実装
  summarizer/               # Summarizer + passthrough / llm
  pipeline.ts               # collect() オーケストレーション
public/                     # sw.js, icons, manifest 資材
docs/design.md              # システム設計書（設計の正）
vercel.json                 # Cron定義
```

### コア型（`lib/types.ts` の指針）
- `Ticker = 'IONQ' | 'XE' | 'ANTHROPIC'`
- `NewsItem = { id, ticker, title, url, source, publishedAt, summary, createdAt }`
- `source = 'google_news' | 'yahoo_finance' | 'sec_edgar'`

---

## 4. コーディング規約

- **TypeScript strict**。`any` は使わない（やむを得ない場合は `unknown` + 絞り込み）。
- **named export** を基本とする（ページ/レイアウト等 Next.js が default を要求する箇所は例外）。
- **import エイリアス** は `@/*`（`tsconfig.json` 設定済）。
- 関数・変数は**目的が分かる命名**。1ファイル1責務を意識。
- 副作用（外部API・I/O）は `lib/` のProvider/Source層に閉じ込め、UI/Route Handlerを薄く保つ。
- **シークレットをハードコードしない**。必ず環境変数（`process.env`）経由。`.env*` はコミットしない。
- エラーは握りつぶさない。収集失敗は1ソース単位で握って他ソースを止めない（部分的失敗の許容）が、ログには残す。
- 周辺コードのスタイル（コメント密度・命名・既存の書き方）に合わせる。

### 環境変数（詳細は `.env.example`）
| 変数 | 用途 | MVP必須 |
|------|------|:------:|
| `NOTION_TOKEN` / `NOTION_DATABASE_ID` | Notion保存 | ✅ |
| `CRON_SECRET` | `/api/cron/collect` の認可 | ✅ |
| `SUMMARIZER` | `passthrough`(既定) / `llm` | — |
| `GROQ_API_KEY` | 非Gemini LLM要約 | 後続 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push | 後続 |

---

## 5. Git / 開発ワークフロー（厳守）

実際の開発現場と同じフローを採用する。

- 🚫 **`main` への直接コミットは禁止**。
- 🌿 機能ごとに**ブランチを切る**: `feat/<name>` / `fix/<name>` / `docs/<name>` / `chore/<name>`。
- 💾 **意味のあるまとまりでこまめにコミット**する。
- 🔼 機能完了後は **Push して Pull Request を作成**する。
- ✅ PR前に `npm run typecheck` と `npm run build` が通ること（緑）を確認。
- コミットメッセージは Conventional Commits 風（`feat:` `fix:` `docs:` `chore:` `refactor:`）。日本語本文可。
- コミットフッターに以下を付ける:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```

---

## 6. よく使うコマンド

| コマンド | 用途 |
|---------|------|
| `npm install` | 依存インストール |
| `npm run dev` | 開発サーバー（http://localhost:3000） |
| `npm run build` | 本番ビルド（PR前に必須） |
| `npm run typecheck` | 型チェック（PR前に必須） |
| `npm run lint` | Lint |
| `git checkout -b feat/<name>` | 機能ブランチ作成 |
| `gh pr create` | Pull Request 作成 |

---

## 7. 実装フェーズ計画（優先順位）

`docs/design.md` §10 に準拠。上から順に着手する。

| 優先 | ブランチ | 内容 |
|:---:|---------|------|
| 1 | `feat/collection-pipeline` | 型 + Source層 + Notion Provider + Passthrough要約 + `/api/cron/collect` + `vercel.json`（**最優先課題**） |
| 2 | `feat/pwa-frontend` | 銘柄別一覧UI + `/api/news` + manifest + ホーム画面追加 |
| 3 | `feat/ai-summary` | `LlmSummarizer`（非Gemini無料LLM）差し込み |
| 4 | `feat/push-notification` | Service Worker Push + VAPID + 購読管理 |

---

## 8. やってはいけないこと（禁止事項）

- ❌ 有料プラン・有料APIの導入（完全無料の制約を破る）
- ❌ X(Twitter) のスクレイピング等、利用規約に反する収集
- ❌ Gemini の採用（本プロジェクトでは非Gemini方針）
- ❌ `main` への直接コミット
- ❌ シークレットのコミット / ハードコード
- ❌ `StorageProvider` を経由しない Notion 直叩き（抽象を壊す）
