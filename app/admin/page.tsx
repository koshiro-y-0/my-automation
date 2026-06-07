import Link from "next/link";
import { AdminPanel } from "../components/AdminPanel";

export const metadata = {
  title: "管理 | US Stock Watch",
};

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-teal-500"
        >
          ← 戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">監視企業の管理</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          新しく追跡したい企業を追加します。追加後の収集から自動で反映されます。
        </p>
      </header>
      <AdminPanel />
    </main>
  );
}
