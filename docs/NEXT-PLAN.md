# 次回改善 実装計画（M6）

本番（https://my-automation-pi.vercel.app）で機能1〜5は稼働確認済み。
次回は以下4点を実装する。各項目は機能ブランチ＋PRで進める（main直コミット禁止）。

確定方針:
- ③ AIピックアップの生成は **毎朝Cronで自動生成**、対象選定は **重要度×新しさで上位**。

着手順（小さい改善 → 大きい機能）:

---

## 改善1: API消費量ゲージを上部に移動　`[ ]`　規模:XS
- `app/page.tsx`: `<UsageGauges />` を `<NewsList />` の**前**（ヘッダー直下）に移動。
- 既定は折りたたみのまま（場所だけ上へ）。
- 触るファイル: `app/page.tsx`
- 検証: 本番トップでゲージが上に出る。

## 改善2: ソートの昇順/降順トグル　`[ ]`　規模:S
- `lib/storage/provider.ts`: `ListOptions` に `direction?: "asc" | "desc"`（既定 desc）。
- `lib/storage/notion.ts` `buildSorts`: 主キー（latest/relevance/importance）に direction を適用。第2キーの公開日時は降順のまま。
- `app/api/news/route.ts`: `dir`(asc|desc) を解釈。
- `app/components/NewsList.tsx`: 並び替えボタンに ▲▼ トグルを追加（押下中のソートを再クリックで昇降反転）。矢印で現在の向きを表示。
- 触るファイル: provider, notion, news route, NewsList
- 検証: `?sort=importance&dir=asc` で昇順、UIトグルで切替。

## 改善4: 記事を10件表示＋「さらに表示」　`[ ]`　規模:S
- `app/components/NewsList.tsx`: 取得は多め（例 limit=60）、**表示は先頭10件**。
  「さらに表示」ボタンで `visibleCount += 10`。タブ/ソート変更時は10にリセット。
- （将来）真のサーバーページング（Notion cursor）に拡張余地あり。今回はクライアント側スライスで十分。
- 触るファイル: NewsList（必要なら news route の limit 既定調整）
- 検証: 初期10件、ボタンで増加、タブ切替でリセット。

## 改善3: 「AI要約」→「AIピックアップ」（各企業の注目まとめ）　`[ ]`　規模:L ★中心
現状 `/digest` は enriched 記事を並べるだけで通常一覧と差が乏しい。
これを **各企業ごとのAI要約ダイジェスト（注目ポイントのまとめ）** に作り替える。

### 仕様
- 命名変更: Nav「✨ AI要約」→「✨ AIピックアップ」。`/digest` を作り替え（または `/picks` 新設）。
- 生成（毎朝Cron）: 収集後、各企業について
  - **直近7日 × 重要度降順→公開日時降順で上位最大10件**を storage から選定
  - その記事群（タイトル/要約）をGroqに渡し、**「各社の注目ポイント」を箇条書き3〜5点**に集約要約
  - Groqロック中はスキップ（前日分を維持）
- 保存: 新規 Notion「Picks」DB（1企業×1日=1行）
  - プロパティ: `Ticker`(title) / `Date` / `Digest`(rich_text) / `Articles`(rich_text: 選定記事のURL/タイトル) / `GeneratedAt`
- API: `GET /api/picks` → 各企業の最新ダイジェスト＋選定記事
- PWA: AIピックアップページ＝企業ごとのカード（企業名＋ダイジェスト本文＋選定記事リンク＋★）
- 併せて修正: **titleJa の固有名詞誤訳**（例「IonQ→イオンキューブ」）。プロンプトに「企業名・製品名などの固有名詞は翻訳せず原表記を保持」を追加。

### 触るファイル（想定）
- `lib/types.ts`（Pick 型）
- `lib/picks/store.ts`（Picks DB 読み書き）, `lib/picks/generate.ts`（選定＋Groq集約）
- `lib/pipeline.ts` か `app/api/cron/collect/route.ts`（収集後にピック生成を呼ぶ）
- `app/api/picks/route.ts`
- `app/digest/page.tsx`（作り替え）, `app/components/Nav.tsx`（名称変更）
- `lib/summarizer/llm.ts`（固有名詞プロンプト修正）
- Notion: Picks DB 作成（スクリプトで）＋ `NOTION_PICKS_DATABASE_ID` を env に追加
- 検証: 収集→各企業ダイジェスト生成→`/api/picks`／PWA表示、Groq消費が企業数ぶんに収まる。

---

## 進め方の提案
- **PR-A（UI改善まとめ）**: 改善1＋改善4＋改善2（小さいUI変更3点）
- **PR-B（AIピックアップ）**: 改善3（独立した機能）
- もしくは4本に分割。レビュー粒度の好みで選ぶ。

## 横断メモ
- バックフィル残り約140件は Groq 日次上限リセット後に `npm run backfill` で完了させる。
- 本番 env（設定済）: `NOTION_TICKERS_DATABASE_ID` / `ADMIN_PASSWORD` / `NOTION_USAGE_DATABASE_ID`。
  改善3で `NOTION_PICKS_DATABASE_ID` を追加予定。
