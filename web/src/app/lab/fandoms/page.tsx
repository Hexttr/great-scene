"use client";

import { useCallback, useEffect, useState } from "react";

const LS_KEY = "great-scene-gemini-key";

type Fandom = {
  id: string;
  slug: string;
  title: string;
  canonSummary: string;
  visualStyleNotes: string | null;
  freeformSource: string | null;
  _count: { scenes: number };
};

export default function FandomsPage() {
  const [rows, setRows] = useState<Fandom[]>([]);
  const [freeform, setFreeform] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [canon, setCanon] = useState("");
  const [visual, setVisual] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    try {
      const k = localStorage.getItem(LS_KEY);
      if (k) setGeminiKey(k);
    } catch {
      /* ignore */
    }
  }, []);

  const persistKey = useCallback((k: string) => {
    setGeminiKey(k);
    try {
      localStorage.setItem(LS_KEY, k);
    } catch {
      /* ignore */
    }
  }, []);

  const load = async () => {
    const r = await fetch("/api/fandoms");
    setRows(await r.json());
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreateFromText = async () => {
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/fandoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeform: freeform.trim(),
          geminiApiKey: geminiKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : JSON.stringify(data.error ?? data));
        return;
      }
      setFreeform("");
      void load();
    } catch (e) {
      setBusy(false);
      setMsg(e instanceof Error ? e.message : "ошибка сети");
    }
  };

  const onCreateManual = async () => {
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
        Опишите фандом <strong>свободным текстом</strong> — Gemini разберёт описание и заполнит
        канон и стиль для блока <code className="text-amber-300/90">fandom_canon</code> в промпте.
        Пул сцен ограничен 50 на фандом.
      </p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">Новый фандом из текста</h2>
        <label className="mb-2 block text-xs text-zinc-400">
          Ключ Gemini API (как в лаборатории; хранится в браузере)
          <input
            type="password"
            autoComplete="off"
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm"
            placeholder="AIza…"
            value={geminiKey}
            onChange={(e) => persistKey(e.target.value)}
          />
        </label>
        <textarea
          className="min-h-[140px] w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm"
          placeholder="Например: тёмное фэнтези, школа магии, свечи, готика, дождь по стёклам, тёплый свет факелов, запретный лес…"
          value={freeform}
          onChange={(e) => setFreeform(e.target.value)}
        />
        <button
          type="button"
          className="mt-3 rounded bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
          disabled={busy || freeform.trim().length < 5 || !geminiKey.trim()}
          onClick={() => void onCreateFromText()}
        >
          {busy ? "Анализ и создание…" : "Разобрать с Gemini и создать"}
        </button>
        {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <button
          type="button"
          className="mb-3 text-sm text-zinc-400 underline hover:text-zinc-200"
          onClick={() => setShowManual(!showManual)}
        >
          {showManual ? "Скрыть ввод вручную" : "Добавить вручную (slug и поля)"}
        </button>
        {showManual && (
          <>
            <h2 className="mb-3 text-sm font-medium text-zinc-500">Вручную</h2>
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
              className="mt-2 rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800"
              onClick={() => void onCreateManual()}
            >
              Создать без Gemini
            </button>
          </>
        )}
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
            {f.freeformSource && (
              <p className="mt-1 text-xs text-zinc-500">
                Исходное описание: {f.freeformSource.slice(0, 160)}
                {f.freeformSource.length > 160 ? "…" : ""}
              </p>
            )}
            <p className="mt-1 text-zinc-400">{f.canonSummary.slice(0, 200)}…</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
