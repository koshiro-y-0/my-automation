import { ChatPanel } from "../components/ChatPanel";
import { Nav } from "../components/Nav";

export const metadata = {
  title: "AIチャット | US Stock Watch",
};

export default function ChatPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">💬 AIチャット</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          収集済みニュースを根拠に、企業について質問できます（自分専用）
        </p>
        <div className="mt-4">
          <Nav active="chat" />
        </div>
      </header>
      <ChatPanel />
    </main>
  );
}
