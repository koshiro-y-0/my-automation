# US Stock Watch — 米国株情報収集・自動化ワークフロー

米国株（**IONQ・X-energy・Anthropic**）に関する情報収集を **完全無料** で自動化し、
iPhone（PWA）で閲覧できるパーソナル・ワークフローです。

> 最優先課題は「手動コピペによる情報収集の手間をなくす」こと。

## 概要

```
RSS / SEC EDGAR  →  Vercel Cron（収集）  →  Notion DB  →  PWA（Vercel）  →  iPhone
```

- **収集**: Next.js Route Handler を Vercel Cron で毎朝1回実行
- **保存**: Notion（`StorageProvider` 抽象化レイヤー経由）
- **表示**: Next.js PWA（ホーム画面に追加してアプリ化）
- **要約**: 後続フェーズで非Gemini無料LLM（Groq等）を差し込み
- **通知**: 後続フェーズで iOS Web Push（iOS16+）

設計の詳細は [`docs/design.md`](docs/design.md)、AI開発の指針は [`CLAUDE.md`](CLAUDE.md) を参照。

## 技術スタック

Next.js 15 (App Router) / React 19 / TypeScript / Tailwind CSS v4 / Vercel

## セットアップ

```bash
npm install
cp .env.example .env.local   # 各値を設定
npm run dev                  # http://localhost:3000
```

## スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run typecheck` | 型チェック |
| `npm run lint` | Lint |

## 開発フロー

- `main` への直接コミットは禁止。機能ごとにブランチを切る。
- 意味のあるまとまりでこまめにコミット。
- 完了したら Push して Pull Request を作成。

詳細は [`CLAUDE.md`](CLAUDE.md)。
