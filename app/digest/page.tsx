import { NewsList } from "../components/NewsList";
import { Nav } from "../components/Nav";

export const metadata = {
  title: "AI要約ダイジェスト | US Stock Watch",
};

export default function DigestPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              ✨ AI要約ダイジェスト
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              AIが日本語で要約・採点した記事だけを表示
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Nav active="digest" />
        </div>
      </header>
      <NewsList enrichedOnly />
    </main>
  );
}
