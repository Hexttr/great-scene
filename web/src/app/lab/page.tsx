"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Fandom = {
  id: string;
  slug: string;
  title: string;
  canonSummary: string;
  visualStyleNotes: string | null;
  _count: { scenes: number };
};

type Scene = {
  id: string;
  title: string;
  scenePromptSeed: string;
  compositionNotes: string | null;
  emotionNotes: string | null;
};

type Block = {
  blockKey: string;
  label: string | null;
  content: string;
  enabled: boolean;
  strength: number;
  sortOrder: number;
};

type PromptTemplate = {
  id: string;
  name: string;
  blocks: Block[];
};

const LS_KEY = "great-scene-gemini-key";

export default function LabPage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [fandoms, setFandoms] = useState<Fandom[]>([]);
  const [fandomId, setFandomId] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState<string>("");
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);

  const [photoId, setPhotoId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [analyzeJson, setAnalyzeJson] = useState<string>("");
  const [assembledPreview, setAssembledPreview] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [imageSize, setImageSize] = useState("2K");
  const [model, setModel] = useState("gemini-3-pro-image-preview");
  const [skipCharge, setSkipCharge] = useState(true);

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

  const loadMeta = useCallback(async () => {
    const [fr, tr] = await Promise.all([
      fetch("/api/fandoms").then((r) => r.json()),
      fetch("/api/prompt-templates").then((r) => r.json()),
    ]);
    setFandoms(fr);
    setTemplates(tr);
    if (fr[0] && !fandomId) setFandomId(fr[0].id);
    if (tr[0] && !templateId) {
      setTemplateId(tr[0].id);
      setBlocks(tr[0].blocks);
    }
  }, [fandomId, templateId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void (async () => {
      if (!fandomId) return;
      const r = await fetch(`/api/scenes?fandomId=${fandomId}`);
      const data = await r.json();
      setScenes(data);
      setSceneId("");
    })();
  }, [fandomId]);

  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (t) setBlocks(t.blocks);
  }, [templateId, templates]);

  const onPickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setBlocks(t.blocks);
  };

  const onUpload = async (file: File) => {
    setError("");
    setBusy("upload");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/photos", { method: "POST", body: fd });
    if (!res.ok) {
      setBusy("");
      setError(await res.text());
      return;
    }
    const data = await res.json();
    setPhotoId(data.id);
    setPhotoUrl(data.url);
    setBusy("");
  };

  const onAnalyze = async () => {
    if (!photoId || !geminiKey) {
      setError("Нужны фото и ключ Gemini для анализа");
      return;
    }
    setBusy("analyze");
    setError("");
    const res = await fetch(`/api/photos/${photoId}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geminiApiKey: geminiKey }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setError(data.error ?? JSON.stringify(data));
      return;
    }
    setAnalyzeJson(JSON.stringify(data.normalized, null, 2));
  };

  const onEnsurePool = async () => {
    if (!fandomId || !geminiKey) return;
    setBusy("pool");
    setError("");
    const res = await fetch("/api/scenes/ensure-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fandomId, geminiApiKey: geminiKey }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setError(data.error ?? "ошибка пула сцен");
      return;
    }
    const r = await fetch(`/api/scenes?fandomId=${fandomId}`);
    setScenes(await r.json());
    loadMeta();
  };

  const onGenerate = async () => {
    if (!photoId || !fandomId || !geminiKey) {
      setError("Нужны фото, фандом и ключ Gemini");
      return;
    }
    setBusy("gen");
    setError("");
    setOutputUrl(null);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPhotoId: photoId,
        fandomId,
        sceneId: sceneId || undefined,
        promptTemplateId: templateId || undefined,
        blocks: blocks.map((b) => ({
          blockKey: b.blockKey,
          label: b.label,
          content: b.content,
          enabled: b.enabled,
          strength: b.strength,
          sortOrder: b.sortOrder,
        })),
        geminiApiKey: geminiKey,
        model,
        aspectRatio,
        imageSize,
        skipCharge,
        chargeCents: 50,
      }),
    });
    const data = await res.json();
    setBusy("");
    if (!res.ok) {
      setError(data.error ?? JSON.stringify(data));
      return;
    }
    setOutputUrl(data.imageUrl);
    setAssembledPreview(data.assembledPrompt ?? "");
  };

  const blockEditor = useMemo(() => {
    const sorted = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted.map((b, i) => (
      <div
        key={`${b.blockKey}-${i}`}
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={b.enabled}
              onChange={(e) => {
                const next = [...blocks];
                const idx = next.findIndex(
                  (x) => x.blockKey === b.blockKey && x.sortOrder === b.sortOrder
                );
                if (idx >= 0) next[idx] = { ...next[idx], enabled: e.target.checked };
                setBlocks(next);
              }}
            />
            {b.blockKey}
          </label>
          <span className="text-xs text-zinc-400">
            вес{" "}
            <input
              type="number"
              step={0.05}
              min={0.25}
              max={2}
              className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1"
              value={b.strength}
              onChange={(e) => {
                const v = Number(e.target.value);
                const next = [...blocks];
                const idx = next.findIndex(
                  (x) => x.blockKey === b.blockKey && x.sortOrder === b.sortOrder
                );
                if (idx >= 0) next[idx] = { ...next[idx], strength: v };
                setBlocks(next);
              }}
            />
          </span>
        </div>
        <textarea
          className="min-h-[72px] w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-200"
          value={b.content}
          onChange={(e) => {
            const next = [...blocks];
            const idx = next.findIndex(
              (x) => x.blockKey === b.blockKey && x.sortOrder === b.sortOrder
            );
            if (idx >= 0) next[idx] = { ...next[idx], content: e.target.value };
            setBlocks(next);
          }}
        />
      </div>
    ));
  }, [blocks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Лаборатория промптов</h1>
        <p className="max-w-3xl text-sm text-zinc-400">
          Загрузите референс-фото, настройте блоки промпта, вставьте ключ Gemini API (хранится
          только в localStorage), при необходимости пополните пул сцен и сгенерируйте кадр моделью
          Nano Banana Pro (<code className="text-amber-300/90">gemini-3-pro-image-preview</code>).
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Ключ Gemini API
          </h2>
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
            placeholder="AIza…"
            value={geminiKey}
            onChange={(e) => persistKey(e.target.value)}
          />
          <p className="text-xs text-zinc-500">
            Ключ остаётся в браузере; сервер получает его только для запросов к API в этой сессии.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Генерация
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Модель
              <input
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </label>
            <label className="text-xs text-zinc-400">
              Соотношение сторон
              <select
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              >
                {["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Размер изображения
              <select
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
              >
                {["1K", "2K", "4K"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={skipCharge}
                onChange={(e) => setSkipCharge(e.target.checked)}
              />
              Пропустить списание (mock-кошелёк)
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Референсное фото
        </h2>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        {photoUrl && (
          <div className="mt-3 flex flex-wrap gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="вход" className="max-h-48 rounded border border-zinc-700" />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
                disabled={!!busy || !geminiKey}
                onClick={() => void onAnalyze()}
              >
                {busy === "analyze" ? "Анализ…" : "Анализ фото (vision)"}
              </button>
              {analyzeJson && (
                <pre className="max-h-40 max-w-xl overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-400">
                  {analyzeJson}
                </pre>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Фандом и сцена
          </h2>
          <label className="mb-2 block text-xs text-zinc-400">
            Фандом
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
              value={fandomId}
              onChange={(e) => setFandomId(e.target.value)}
            >
              {fandoms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f._count.scenes} сцен)
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mb-3 rounded border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-50"
            disabled={!!busy || !geminiKey}
            onClick={() => void onEnsurePool()}
          >
            {busy === "pool" ? "Генерация сцен…" : "Добавить +10 сцен (текстовая модель)"}
          </button>
          <label className="block text-xs text-zinc-400">
            Сцена (необязательно — случайная из пула)
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
              value={sceneId}
              onChange={(e) => setSceneId(e.target.value)}
            >
              <option value="">Случайная из пула</option>
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
            Шаблон промпта
          </h2>
          <select
            className="mb-3 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={templateId}
            onChange={(e) => onPickTemplate(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
          Блоки промпта
        </h2>
        <div className="grid gap-3">{blockEditor}</div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          disabled={!!busy || !photoId || !fandomId || !geminiKey}
          onClick={() => void onGenerate()}
        >
          {busy === "gen" ? "Генерация…" : "Сгенерировать изображение"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {outputUrl && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="mb-3 text-sm font-medium text-zinc-500">Результат</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={outputUrl} alt="результат" className="max-h-[70vh] rounded border border-zinc-700" />
          {assembledPreview && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-zinc-400">Собранный промпт</summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-400">
                {assembledPreview}
              </pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
