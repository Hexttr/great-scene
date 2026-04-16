"use client";

import { useEffect, useState } from "react";

type Fandom = {
  id: string;
  slug: string;
  title: string;
  canonSummary: string;
  visualStyleNotes: string | null;
  _count: { scenes: number };
};

export default function FandomsPage() {
  const [rows, setRows] = useState<Fandom[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [canon, setCanon] = useState("");
  const [visual, setVisual] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r = await fetch("/api/fandoms");
    setRows(await r.json());
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async () => {
    setMsg("");
    const res = await fetch("/api/fandoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        title,
        canonSummary: canon,
        visualStyleNotes: visual || undefined,
      }),
    });
    if (!res.ok) setMsg(await res.text());
    else {
      setSlug("");
      setTitle("");
      setCanon("");
      setVisual("");
      void load();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Фандомы</h1>
      <p className="text-sm text-zinc-400">
        Краткое описание канона попадает в блок <code className="text-amber-300/90">fandom_canon</code>{" "}
        в промпте. Пул сцен ограничен 50 на фандом.
      </p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Добавить фандом</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            placeholder="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <input
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            placeholder="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <textarea
          className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          placeholder="Канон / описание вселенной"
          rows={4}
          value={canon}
          onChange={(e) => setCanon(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
          placeholder="Заметки по визуальному стилю (необязательно)"
          rows={2}
          value={visual}
          onChange={(e) => setVisual(e.target.value)}
        />
        <button
          type="button"
          className="mt-2 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950"
          onClick={() => void onCreate()}
        >
          Создать
        </button>
        {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
      </div>

      <ul className="space-y-2">
        {rows.map((f) => (
          <li
            key={f.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm"
          >
            <div className="font-medium text-zinc-100">{f.title}</div>
            <div className="text-xs text-zinc-500">
              {f.slug} · {f._count.scenes} сцен
            </div>
            <p className="mt-1 text-zinc-400">{f.canonSummary.slice(0, 200)}…</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
