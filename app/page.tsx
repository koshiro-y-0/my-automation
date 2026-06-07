import { NewsList } from "./components/NewsList";
import { EnablePushButton } from "./components/EnablePushButton";
import { Nav } from "./components/Nav";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">US Stock Watch</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              IONQ・X-energy・Anthropic の最新ニュースを毎朝自動収集
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <EnablePushButton />
          </div>
        </div>
        <div className="mt-4">
          <Nav active="home" />
        </div>
      </header>
      <NewsList />
    </main>
  );
}
