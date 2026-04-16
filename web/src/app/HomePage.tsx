"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const LS_KEY = "great-scene-gemini-key";

type PromptTemplate = {
  id: string;
  name: string;
  blocks: {
    blockKey: string;
    label: string | null;
    content: string;
    enabled: boolean;
    strength: number;
    sortOrder: number;
  }[];
};

export default function HomePage() {
  const [geminiKey, setGeminiKey] = useState("");
  const [freeform, setFreeform] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [aspectRatio, setAspectRatio] = useState("3:4");
  const [imageSize, setImageSize] = useState("2K");

  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [assembledPreview, setAssembledPreview] = useState("");

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

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const runPipeline = async () => {
    setError("");
    setOutputUrl(null);
    setAssembledPreview("");
    if (freeform.trim().length < 5) {
      setError("Опишите фандом (от 5 символов).");
      return;
    }
    if (!geminiKey.trim()) {
      setError("Нужен ключ Gemini API.");
      return;
    }
    if (!file) {
      setError("Выберите фото.");
      return;
    }

    try {
      setBusy("fandom");
      const fr = await fetch("/api/fandoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeform: freeform.trim(),
          geminiApiKey: geminiKey,
        }),
      });
      const fandomData = await fr.json();
      if (!fr.ok) {
        setBusy("");
        setError(
          typeof fandomData.error === "string"
            ? fandomData.error
            : JSON.stringify(fandomData.error ?? fandomData)
        );
        return;
      }
      const fandomId = fandomData.id as string;

      setBusy("upload");
      const fd = new FormData();
      fd.append("file", file);
      const pr = await fetch("/api/photos", { method: "POST", body: fd });
      const photoData = await pr.json();
      if (!pr.ok) {
        setBusy("");
        setError(photoData.error ?? (await pr.text()));
        return;
      }
      const photoId = photoData.id as string;

      setBusy("pool");
      const poolRes = await fetch("/api/scenes/ensure-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fandomId, geminiApiKey: geminiKey }),
      });
      const poolData = await poolRes.json();
      if (!poolRes.ok) {
        setBusy("");
        setError(poolData.error ?? "Не удалось подготовить пул сцен");
        return;
      }

      setBusy("template");
      const templates = (await fetch("/api/prompt-templates").then((r) => r.json())) as PromptTemplate[];
      const t = templates[0];
      if (!t?.blocks?.length) {
        setBusy("");
        setError("Нет шаблона промпта. Выполните: npm run db:seed");
        return;
      }

      setBusy("gen");
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPhotoId: photoId,
          fandomId,
          promptTemplateId: t.id,
          blocks: t.blocks.map((b) => ({
            blockKey: b.blockKey,
            label: b.label,
            content: b.content,
            enabled: b.enabled,
            strength: b.strength,
            sortOrder: b.sortOrder,
          })),
          geminiApiKey: geminiKey,
          model: "gemini-3-pro-image-preview",
          aspectRatio,
          imageSize,
          skipCharge: true,
          chargeCents: 50,
        }),
      });
      const genData = await genRes.json();
      setBusy("");
      if (!genRes.ok) {
        setError(genData.error ?? JSON.stringify(genData));
        return;
      }
      setOutputUrl(genData.imageUrl as string);
      setAssembledPreview((genData.assembledPrompt as string) ?? "");
    } catch (e) {
      setBusy("");
      setError(e instanceof Error ? e.message : "Ошибка запроса");
    }
  };

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="font-semibold tracking-tight text-amber-400">Great Scene</span>
          <nav className="flex gap-4 text-sm text-zinc-400">
            <Link className="hover:text-zinc-100" href="/lab">
              Расширенная лаборатория
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Быстрая генерация</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Опишите фандом своими словами, загрузите референсное фото и запустите генерацию. Фандом
            будет разобран моделью и сохранён; сцены подгрузятся автоматически.
          </p>
        </div>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Ключ Gemini API
          </label>
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm"
            placeholder="AIza…"
            value={geminiKey}
            onChange={(e) => persistKey(e.target.value)}
          />
          <p className="text-xs text-zinc-500">Хранится в браузере (localStorage), как в лаборатории.</p>
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Фандом (свободный текст)
          </label>
          <textarea
            className="min-h-[120px] w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="Опишите атмосферу, вселенную, визуальные образы…"
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Референсное фото
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Превью"
              className="mt-2 max-h-56 rounded border border-zinc-700"
            />
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">
            Соотношение сторон
            <select
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
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
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm"
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
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            disabled={
              !!busy ||
              freeform.trim().length < 5 ||
              !geminiKey.trim() ||
              !file
            }
            onClick={() => void runPipeline()}
          >
            {busy === "fandom" && "Фандом…"}
            {busy === "upload" && "Загрузка фото…"}
            {busy === "pool" && "Пул сцен…"}
            {busy === "template" && "Шаблон…"}
            {busy === "gen" && "Генерация…"}
            {!busy && "Сгенерировать"}
          </button>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>

        {outputUrl && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-400">Результат</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outputUrl}
              alt="Результат"
              className="max-h-[70vh] rounded border border-zinc-700"
            />
            {assembledPreview && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-zinc-400">Собранный промпт</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-500">
                  {assembledPreview}
                </pre>
              </details>
            )}
            <p className="mt-3 text-sm text-zinc-500">
              <Link className="text-amber-400 hover:underline" href="/lab">
                Лаборатория
              </Link>
              {" · "}
              <Link className="text-amber-400 hover:underline" href="/lab/runs">
                все прогоны
              </Link>
              {" — картинки и промпты сохраняются в истории."}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
