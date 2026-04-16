"use client";

import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [topup, setTopup] = useState("1000");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const r = await fetch("/api/wallet");
    const w = await r.json();
    setBalance(w.balanceCents);
  };

  useEffect(() => {
    void load();
  }, []);

  const onTopup = async () => {
    setMsg("");
    const res = await fetch("/api/wallet/mock-topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: Number(topup) }),
    });
    if (!res.ok) setMsg(await res.text());
    else void load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Настройки лаборатории</h1>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="mb-2 text-sm font-medium text-zinc-500">Тестовый кошелёк (ledger)</h2>
        <p className="mb-3 text-sm text-zinc-400">
          Баланс ведётся транзакциями. Списание за генерацию включается, если в лаборатории снять
          галочку «Пропустить списание».
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs text-zinc-500">Баланс (центы)</div>
            <div className="text-2xl font-mono text-emerald-400">
              {balance === null ? "…" : balance}
            </div>
          </div>
          <label className="text-xs text-zinc-400">
            Пополнение (центы)
            <input
              className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm"
              value={topup}
              onChange={(e) => setTopup(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
            onClick={() => void onTopup()}
          >
            Тестовое пополнение
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-red-400">{msg}</p>}
      </section>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        <p>
          Укажите <code className="text-amber-300/90">DATABASE_URL</code> в{" "}
          <code className="text-zinc-300">web/.env</code>. Для локального Postgres используйте{" "}
          <code className="text-zinc-300">docker compose</code> из корня репозитория.
        </p>
        <p className="mt-2">
          Опционально: <code className="text-amber-300/90">GEMINI_API_KEY</code> в{" "}
          <code className="text-zinc-300">web/.env</code> для анализа фото по умолчанию на сервере.
        </p>
      </section>
    </div>
  );
}
