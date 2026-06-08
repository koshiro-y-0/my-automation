import { PicksList } from "../components/PicksList";
import { Nav } from "../components/Nav";

export const metadata = {
  title: "AIピックアップ | US Stock Watch",
};

export default function DigestPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">✨ AIピックアップ</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          各企業の注目記事をAIが毎朝まとめます
        </p>
        <div className="mt-4">
          <Nav active="digest" />
        </div>
      </header>
      <PicksList />
    </main>
  );
}
