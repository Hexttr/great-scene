"use client";

import { useEffect, useState } from "react";

type Fandom = { id: string; title: string; slug: string };
type Scene = {
  id: string;
  title: string;
  scenePromptSeed: string;
  fingerprint: string;
  sourceType: string;
};

export default function ScenesPage() {
  const [fandoms, setFandoms] = useState<Fandom[]>([]);
  const [fandomId, setFandomId] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    void fetch("/api/fandoms")
      .then((r) => r.json())
      .then((rows: Fandom[]) => {
        setFandoms(rows);
        if (rows[0]) setFandomId(rows[0].id);
      });
  }, []);

  useEffect(() => {
    if (!fandomId) return;
    void fetch(`/api/scenes?fandomId=${fandomId}`)
      .then((r) => r.json())
      .then(setScenes);
  }, [fandomId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Сцены</h1>
      <p className="text-sm text-zinc-400">
        Просмотр сгенерированных заготовок сцен. В лаборатории используйте «Добавить +10 сцен», чтобы
        пополнять пул (до 50 на фандом).
      </p>
      <select
        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
        value={fandomId}
        onChange={(e) => setFandomId(e.target.value)}
      >
        {fandoms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title}
          </option>
        ))}
      </select>
      <ul className="space-y-3">
        {scenes.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-sm"
          >
            <div className="font-medium text-zinc-100">{s.title}</div>
            <div className="text-xs text-zinc-500">
              {s.sourceType} · отпечаток:{s.fingerprint}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-zinc-400">{s.scenePromptSeed}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
