import Link from "next/link";

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/lab" className="font-semibold tracking-tight text-amber-400">
            Great Scene Lab
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm text-zinc-400">
            <Link className="hover:text-zinc-100" href="/lab">
              Лаборатория
            </Link>
            <Link className="hover:text-zinc-100" href="/lab/fandoms">
              Фандомы
            </Link>
            <Link className="hover:text-zinc-100" href="/lab/scenes">
              Сцены
            </Link>
            <Link className="hover:text-zinc-100" href="/lab/runs">
              Прогоны
            </Link>
            <Link className="hover:text-zinc-100" href="/lab/settings">
              Настройки
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
