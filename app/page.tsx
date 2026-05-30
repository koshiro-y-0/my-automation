export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-2xl font-bold tracking-tight">US Stock Watch</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        米国株（IONQ・X-energy・Anthropic）の情報を毎朝自動収集する
        パーソナル・ワークフロー。
      </p>
      <p className="mt-6 rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        🚧 セットアップ中です。収集パイプラインと銘柄別ニュース一覧は
        後続の機能ブランチで実装します（詳細は{" "}
        <code className="font-mono">docs/design.md</code> を参照）。
      </p>
    </main>
  );
}
