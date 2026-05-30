# システム設計書 — 米国株情報収集・自動化ワークフロー

> 親ドキュメント: `automation_plan.docx`（米国株情報収集・自動化ワークフロー計画書 / 2026-05-26）
> 本書は計画書を技術設計に落とし込んだもの。実装・レビューの一次基準とする。
> 最終更新: 2026-05-30

---

## 1. 目的とゴール

米国株（**IONQ・X-energy・Anthropic**）に関する情報収集を **完全無料** で自動化し、
iPhone（PWA）で閲覧できる仕組みを構築する。

最優先課題は **「手動コピペによる情報収集の手間をなくす」** こと。

### 成功条件（Definition of Done）
- 毎朝1回、対象銘柄のニュースが自動収集され Notion に保存される
- iPhone のホーム画面アプリ（PWA）で銘柄別に一覧閲覧できる
- 運用コストが完全に 0 円（有料プラン・有料API不使用）

---

## 2. 計画書からの設計変更点（意思決定ログ）

計画書からの逸脱は、すべてここに理由とともに記録する。

| # | 計画書 | 本設計 | 理由 |
|---|--------|--------|------|
| D1 | Make（外部GUI）でRSS→Notion収集 | **Vercel Cron + Next.js Route Handler でコード化** | 全てGit管理下に置け、現場同様のレビュー/CIが可能。Makeの手動GUI設定を排除し再現性を確保 |
| D2 | Notion を直接データストアに | **Notion + `StorageProvider` 抽象化レイヤー** | 計画書の「Notion活用」を維持しつつ、将来 Postgres 等へ無改修で差し替え可能に |
| D3 | （言及なし） | **`Summarizer` 抽象 + 非Geminiクラウド無料LLM** | AI要約を後付け可能に。MVPは要約なし(Passthrough)で最優先課題を最速達成。LLMはGroq等の非Gemini無料枠 |
| D4 | プッシュ通知を初期から | **MVP後回し**（設計はするが実装は後続ブランチ） | iOS Web Push は VAPID/Service Worker/購読管理の検証コストが高く、最優先課題と独立 |

---

## 3. アーキテクチャ

```
┌─ 収集パイプライン（Vercel Cron / 毎朝1回） ──────────────┐
│  GET /api/cron/collect                                    │
│    1. Source層が各ソースから記事取得                       │
│       ├ GoogleNewsSource（銘柄×キーワードのRSS）          │
│       ├ YahooFinanceSource（IONQ/XE 株価ニュースRSS）     │
│       └ SecEdgarSource（決算・開示 Atom/JSON）            │
│    2. NewsItem に正規化                                    │
│    3. 重複排除（id = URLのSHA-256ハッシュ）               │
│    4. Summarizer で概要生成（MVP=Passthrough）            │
│    5. StorageProvider.saveMany() → Notion DB             │
│    6. （後続）新着あれば Web Push 送信                     │
└───────────────────────────────────────────────────────────┘
                      ↓ Notion DB（正データ / 人間も直接閲覧可）
┌─ PWA フロントエンド（Vercel） ──────────────────────────┐
│  /              銘柄別ニュース一覧（ISR/キャッシュ）      │
│  /api/news      StorageProvider.list() で読み出し         │
│  manifest + Service Worker（オフライン / 後続でPush受信）  │
│  → iPhone ホーム画面に追加してアプリとして利用             │
└───────────────────────────────────────────────────────────┘
```

### 設計原則
- **依存性逆転**: 上位ロジックは `Source` / `StorageProvider` / `Summarizer` の**インターフェース**にのみ依存。具体実装（Notion, Groq, 各RSS）は差し替え可能。
- **冪等性**: 収集は何度実行しても重複保存されない（id による upsert）。
- **無料枠厳守**: 外部呼び出し回数・実行頻度は無料枠内に収める。

---

## 4. データモデル

### `NewsItem`
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | URL の SHA-256（重複排除キー / 冪等性の要） |
| `ticker` | `'IONQ' \| 'XE' \| 'ANTHROPIC'` | 銘柄 |
| `title` | string | 記事タイトル |
| `url` | string | 記事URL |
| `source` | `'google_news' \| 'yahoo_finance' \| 'sec_edgar'` | 収集元 |
| `publishedAt` | string (ISO8601) | 記事公開日時 |
| `summary` | string | 概要（MVP=RSS抜粋、将来=AI要約） |
| `createdAt` | string (ISO8601) | 収集日時 |

### Notion データベース プロパティ対応
| Notion プロパティ | 型 | NewsItem |
|------------------|-----|----------|
| Title | title | `title` |
| Ticker | select | `ticker` |
| URL | url | `url` |
| Source | select | `source` |
| PublishedAt | date | `publishedAt` |
| Summary | rich_text | `summary` |
| Hash | rich_text | `id`（重複チェック用） |

---

## 5. 監視銘柄設定（`lib/config/tickers.ts`）

| ticker | 正式名 | 状態 | 関連キーワード |
|--------|--------|------|---------------|
| `IONQ` | IonQ | 上場済 | 量子コンピュータ, quantum computing, IBM, Google quantum |
| `XE` | X-energy | 上場済 | 小型原子炉, SMR, small modular reactor, エネルギー政策 |
| `ANTHROPIC` | Anthropic | 未上場(IPO追跡) | AI規制, AI regulation, OpenAI, 資金調達, funding, IPO |

> 拡張余地: 無料枠内で最大10銘柄まで（計画書 5-4）。

---

## 6. インターフェース定義（抜粋）

```ts
// lib/sources/source.ts
export interface Source {
  readonly name: NewsItem['source'];
  fetch(ticker: TickerConfig): Promise<RawArticle[]>;
}

// lib/storage/provider.ts
export interface StorageProvider {
  saveMany(items: NewsItem[]): Promise<{ saved: number; skipped: number }>;
  list(opts?: { ticker?: Ticker; limit?: number }): Promise<NewsItem[]>;
  existingIds(ids: string[]): Promise<Set<string>>; // 冪等性チェック
}

// lib/summarizer/summarizer.ts
export interface Summarizer {
  summarize(article: RawArticle): Promise<string>;
}
// MVP: PassthroughSummarizer（RSS description をそのまま返す）
// 後続: LlmSummarizer（Groq 等の非Gemini 無料LLM）
```

---

## 7. 実行スケジュール / 無料枠試算

- **頻度**: 1日1回（毎朝）— `vercel.json` の cron で定義
- **試算**: 3銘柄 × 3ソース × 1回/日 ≒ 月270リクエスト程度。各サービスの無料枠内。
- Vercel Cron: 無料プランで日次実行可能。
- Notion API: レート制限 〜3 req/s → 収集は逐次/小バッチで実行。

---

## 8. 環境変数（`.env.example`）

| 変数 | 用途 | MVP必須 |
|------|------|:-------:|
| `NOTION_TOKEN` | Notion Integration トークン | ✅ |
| `NOTION_DATABASE_ID` | 保存先 Notion DB | ✅ |
| `CRON_SECRET` | `/api/cron/collect` の認可（Vercel Cron が付与） | ✅ |
| `SUMMARIZER` | `passthrough`(既定) / `llm` | — |
| `GROQ_API_KEY` | LLM要約（方式A・非Gemini） | 後続 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push | 後続 |

---

## 9. ディレクトリ構成

```
app/
  layout.tsx, page.tsx, globals.css
  manifest.ts                 # PWA manifest
  api/
    cron/collect/route.ts     # 収集パイプライン本体（Cronトリガ）
    news/route.ts             # PWA向け読み出しAPI
    push/subscribe/route.ts   # （後続）購読登録
lib/
  types.ts                    # NewsItem, Ticker 等
  config/tickers.ts           # 監視銘柄定義
  sources/                    # Source実装（google-news, yahoo-finance, sec-edgar）
  storage/                    # StorageProvider + notion実装
  summarizer/                 # Summarizer + passthrough/llm実装
  pipeline.ts                 # collect() オーケストレーション
public/
  sw.js, icons/, manifest 資材
docs/
  design.md                   # 本書
vercel.json                   # Cron定義
CLAUDE.md                     # AI開発指針
.env.example
```

---

## 10. 実装フェーズ計画（優先順位）

| 優先 | ブランチ | 内容 | 計画書との対応 |
|:---:|---------|------|---------------|
| 1 | `feat/collection-pipeline` | 型定義 + Source層 + Notion StorageProvider + Passthrough要約 + `/api/cron/collect` + vercel.json | **最優先課題（手動コピペ解消）** |
| 2 | `feat/pwa-frontend` | 銘柄別一覧UI + `/api/news` + manifest + ホーム画面追加対応 | 5-6 PWA表示 |
| 3 | `feat/ai-summary` | `LlmSummarizer`（Groq等・非Gemini）差し込み | D3 / AI要約 |
| 4 | `feat/push-notification` | Service Worker Push + VAPID + 購読管理 | 5-6 プッシュ通知 |

各機能は機能ブランチを切り、こまめにコミット → Push → PR で進める（メイン直コミット禁止）。

---

## 11. リスク・留意点

- **法令/規約遵守**: X(Twitter) のスクレイピングは行わない（計画書3）。公式RSS/EDGARの公開フィードのみ利用。
- **無料枠超過**: Vercel/Notion/LLM の無料枠を監視。超過しそうなら頻度・銘柄数を調整。
- **iOS Web Push の制約**: iOS16+ かつ「ホーム画面に追加」済みの PWA でのみ動作。後続フェーズで実機検証。
- **Notion APIレイテンシ**: PWA表示はキャッシュ（ISR/Runtime Cache）で吸収する。
