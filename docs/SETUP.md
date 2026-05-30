# 本番化 手順書（手動タスク）

機能実装（M1〜M4）はすべて完了済み。残りは**あなたの手元で行う設定・接続・検証**のみ。
このドキュメントを上から順に実施すれば、完全無料で本番稼働する。

> 凡例: ⏱ 目安時間 / 🔑 必須 / ⭐ 任意（後回し可）

---

## ステップ0. ローカル準備　🔑　⏱5分
- [ ] リポジトリを最新化：`git checkout main && git pull`
- [ ] 依存インストール：`npm install`
- [ ] `.env.local` を作成：`cp .env.example .env.local`
- [ ] 起動確認：`npm run dev` → http://localhost:3000 が「🔌 Notion未接続」と表示されればOK

---

## ステップ1. Notion 準備（ニュースDB）　🔑　⏱15分

### 1-1. Integration（APIトークン）作成
- [ ] https://www.notion.so/my-integrations → 「New integration」
- [ ] 名前を付けて作成 → **Internal Integration Token** をコピー
- [ ] `.env.local` の `NOTION_TOKEN=` に貼る

### 1-2. ニュース用データベース作成
- [ ] Notion で新規ページ → 「Table - Full page」でDB作成
- [ ] 以下のプロパティを**正確な名前・型**で用意（設計書 §4）：

| プロパティ名 | 型 |
|------------|-----|
| `Title` | Title（既定） |
| `Ticker` | Select |
| `URL` | URL |
| `Source` | Select |
| `PublishedAt` | Date |
| `Summary` | Text（rich_text） |
| `Hash` | Text（rich_text） |

### 1-3. Integration をDBに接続
- [ ] DBページ右上「…」→「Connections」→ 作成した Integration を追加
- [ ] DBのURLから **Database ID**（32桁英数字）をコピー → `.env.local` の `NOTION_DATABASE_ID=` に貼る
  - URL例: `notion.so/xxxx?v=...` の `xxxx` 部分（32桁）

### 1-4. 接続確認
- [ ] `.env.local` に `CRON_SECRET=` を任意の長い文字列で設定
- [ ] `npm run dev` で起動
- [ ] 別ターミナルで収集を手動実行：
  ```bash
  curl -H "Authorization: Bearer ここにCRON_SECRET" http://localhost:3000/api/cron/collect
  ```
- [ ] レスポンスが `{"ok":true,"saved":...}` になり、Notion DB に記事が入ればOK
- [ ] ブラウザを再読込 → 銘柄別にニュースが並べば**M1+M2が通しで成功** 🎉

---

## ステップ2. Vercel デプロイ　🔑　⏱15分

- [ ] https://vercel.com にGitHubでログイン
- [ ] 「Add New → Project」→ `koshiro-y-0/my-automation` をインポート
- [ ] **Environment Variables** に以下を設定：

| 変数 | 値 | 必須 |
|------|-----|:---:|
| `NOTION_TOKEN` | ステップ1のトークン | 🔑 |
| `NOTION_DATABASE_ID` | ステップ1のDB ID | 🔑 |
| `CRON_SECRET` | 任意の長い文字列 | 🔑 |
| `SEC_USER_AGENT` | `my-automation/0.1 (contact: あなたのメール)` | 推奨 |

- [ ] 「Deploy」→ 完了後、発行URL（`https://xxx.vercel.app`）を開いて表示確認
- [ ] Vercel ダッシュボード → Settings → **Cron Jobs** に `/api/cron/collect`（毎日UTC22:00=JST7:00）が登録されているか確認
- [ ] 動作テスト：Vercel の Cron を「Run」するか、URLに対して上記 curl を叩いて保存を確認

> 📌 注意: Vercel無料プランのCronは「1日1回」。本設計はこれに準拠済み。

---

## ステップ3. AI要約を有効化（Groq）　⭐　⏱5分

- [ ] https://console.groq.com/keys でAPIキーを無料取得（非Gemini）
- [ ] Vercel（とローカル `.env.local`）に環境変数を追加：
  - `SUMMARIZER=llm`
  - `GROQ_API_KEY=取得したキー`
  - （任意）`GROQ_MODEL=llama-3.3-70b-versatile`
- [ ] 再デプロイ → 次回収集分から `Summary` が日本語AI要約になる
- [ ] ※ キーが無効/レート超過でも自動でRSS抜粋にフォールバックするので壊れない

---

## ステップ4. プッシュ通知を有効化　⭐　⏱20分

### 4-1. VAPID鍵生成
- [ ] `npm run gen:vapid` を実行 → 出力された3行を控える

### 4-2. 購読用Notion DB作成
- [ ] ニュースとは**別の**DBを新規作成。プロパティ：

| プロパティ名 | 型 |
|------------|-----|
| `Endpoint` | Title |
| `P256dh` | Text |
| `Auth` | Text |
| `Hash` | Text |

- [ ] Integration を接続 → Database ID をコピー

### 4-3. 環境変数設定（Vercel + ローカル）
- [ ] `VAPID_PUBLIC_KEY=` / `VAPID_PRIVATE_KEY=`
- [ ] `VAPID_SUBJECT=mailto:あなたのメール`
- [ ] `NOTION_PUSH_DATABASE_ID=` 購読用DBのID
- [ ] 再デプロイ

### 4-4. iPhone で有効化
- [ ] Safari で Vercel URL を開く → 共有 →「ホーム画面に追加」
- [ ] ホーム画面のアプリを起動 →「🔔 新着を通知する」をタップ → 許可
- [ ] 翌朝の収集、または手動 curl 実行で新着があれば通知が届く

> 📌 iOSの制約: 通知は **ホーム画面に追加したアプリから** のみ許可できる（Safariタブ内では不可）。iOS16.4以上が必要。

---

## ステップ5. 仕上げ・検証　⏱適宜
- [ ] 数日運用し、毎朝ニュースが増えるか確認
- [ ] Vercel / Notion / Groq の無料枠使用量をたまに確認
- [ ] 改善したい点が出たら Issue 化 → 機能ブランチで対応（main直コミット禁止）

---

## トラブル時の早見表

| 症状 | 確認ポイント |
|------|------------|
| `/api/cron/collect` が401 | `CRON_SECRET` とAuthorizationヘッダが一致しているか |
| 収集は成功するがNotionに入らない | Integrationを**DBに接続**したか / プロパティ名・型が一致しているか |
| ニュースが表示されない | `/api/news` を直接開いて `configured:true` か / 収集を実行したか |
| 通知ボタンが出ない | VAPID鍵 と `NOTION_PUSH_DATABASE_ID` の両方が設定済みか |
| SECが403 | `SEC_USER_AGENT` に連絡先メールが含まれているか |
| AI要約が効かない | `SUMMARIZER=llm` と `GROQ_API_KEY` が設定済みか（未設定はRSS抜粋で正常） |
