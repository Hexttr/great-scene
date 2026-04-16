"use client";

import { useEffect, useState } from "react";

type Run = {
  id: string;
  status: string;
  createdAt: string;
  assembledPrompt: string;
  latencyMs: number | null;
  geminiKeyAlias: string | null;
  fandom: { title: string };
  scene: { title: string } | null;
  assets: { path: string }[];
  reviews: {
    similarityScore: number | null;
    cinematicScore: number | null;
    integrationScore: number | null;
    fandomFidelityScore: number | null;
  }[];
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [pick, setPick] = useState<[Run | null, Run | null]>([null, null]);

  const load = async () => {
    const r = await fetch("/api/runs?take=40");
    setRuns(await r.json());
  };

  useEffect(() => {
    void load();
  }, []);

  const submitReview = async (runId: string, field: string, value: number) => {
    await fetch(`/api/runs/${runId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    void load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Прогоны и оценка</h1>
      <p className="text-sm text-zinc-400">
        Сравните два прогона рядом. Оценки 1–5 (по желанию). В лог пишется только псевдоним ключа, не
        сам ключ.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <h2 className="mb-2 text-sm text-zinc-500">Сравнение A</h2>
          <select
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={pick[0]?.id ?? ""}
            onChange={(e) =>
              setPick([runs.find((r) => r.id === e.target.value) ?? null, pick[1]])
            }
          >
            <option value="">—</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.createdAt.slice(0, 19)} · {r.fandom.title} · {r.status}
              </option>
            ))}
          </select>
          {pick[0]?.assets[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pick[0].assets[0].path}
              alt="a"
              className="mt-2 max-h-64 rounded border border-zinc-700"
            />
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <h2 className="mb-2 text-sm text-zinc-500">Сравнение B</h2>
          <select
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            value={pick[1]?.id ?? ""}
            onChange={(e) =>
              setPick([pick[0], runs.find((r) => r.id === e.target.value) ?? null])
            }
          >
            <option value="">—</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.createdAt.slice(0, 19)} · {r.fandom.title} · {r.status}
              </option>
            ))}
          </select>
          {pick[1]?.assets[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pick[1].assets[0].path}
              alt="b"
              className="mt-2 max-h-64 rounded border border-zinc-700"
            />
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">Время</th>
              <th className="px-3 py-2">Фандом</th>
              <th className="px-3 py-2">Статус</th>
              <th className="px-3 py-2">мс</th>
              <th className="px-3 py-2">Ключ</th>
              <th className="px-3 py-2">Превью</th>
              <th className="px-3 py-2">Оценки</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-zinc-800/80">
                <td className="px-3 py-2 whitespace-nowrap text-zinc-400">
                  {r.createdAt.slice(0, 19)}
                </td>
                <td className="px-3 py-2">{r.fandom.title}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.latencyMs ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                  {r.geminiKeyAlias ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {r.assets[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.assets[0].path}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ["similarityScore", "похож"],
                        ["cinematicScore", "кино"],
                        ["integrationScore", "интегр"],
                        ["fandomFidelityScore", "канон"],
                      ] as const
                    ).map(([field, label]) => (
                      <select
                        key={field}
                        className="rounded border border-zinc-700 bg-zinc-950 px-1 text-xs"
                        defaultValue=""
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (v) void submitReview(r.id, field, v);
                        }}
                      >
                        <option value="">{label}</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
