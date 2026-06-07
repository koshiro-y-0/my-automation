import Link from "next/link";

/** ホーム / AI要約ダイジェスト 間のナビ。 */
export function Nav({ active }: { active: "home" | "digest" }) {
  const base =
    "rounded-full px-3 py-1 text-sm font-medium transition";
  const on = "bg-teal-500 text-white";
  const off =
    "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800";
  return (
    <nav className="flex gap-2">
      <Link href="/" className={`${base} ${active === "home" ? on : off}`}>
        すべて
      </Link>
      <Link
        href="/digest"
        className={`${base} ${active === "digest" ? on : off}`}
      >
        ✨ AI要約
      </Link>
      <Link
        href="/admin"
        className={`${base} ${off} ml-auto`}
        title="監視企業の管理"
      >
        ⚙︎
      </Link>
    </nav>
  );
}
