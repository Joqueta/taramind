"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [veilleRunning, setVeilleRunning] = useState(false);
  const [veilleResult, setVeilleResult] = useState(null);

  useEffect(() => {
    fetchDossiers();
  }, []);

  async function fetchDossiers() {
    setLoading(true);
    const res = await fetch("/api/dossiers");
    const data = await res.json();
    setDossiers(data.dossiers ?? []);
    setLoading(false);
  }

  async function lancerVeille() {
    setVeilleRunning(true);
    setVeilleResult(null);
    try {
      const res = await fetch("/api/veille", { method: "POST" });
      const data = await res.json();
      setVeilleResult(data);
      await fetchDossiers();
    } catch (err) {
      setVeilleResult({ error: err.message });
    } finally {
      setVeilleRunning(false);
    }
  }

  const total = dossiers.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(1, ...dossiers.map((d) => d.count));

  return (
    <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
      {/* Header */}
      <header className="mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Second cerveau de veille
          </p>
          <h1 className="font-display text-5xl font-semibold md:text-6xl">
            Taramind
          </h1>
          <p className="mt-3 max-w-md text-sm text-[var(--text-muted)]">
            {total} source{total > 1 ? "s" : ""} captée{total > 1 ? "s" : ""}, qualifiée
            {total > 1 ? "s" : ""} et rangée{total > 1 ? "s" : ""} par l&apos;agent.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className="flex gap-3">
            <Link
              href="/capture"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Capturer une source
            </Link>
            <Link
              href="/carte"
              className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Carte sémantique
            </Link>
            <button
              onClick={lancerVeille}
              disabled={veilleRunning}
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {veilleRunning ? "Veille en cours…" : "Lancer la veille"}
            </button>
          </div>
          {veilleResult && !veilleResult.error && (
            <p className="text-xs text-[var(--success)]">
              {veilleResult.traites} article{veilleResult.traites > 1 ? "s" : ""} traité
              {veilleResult.traites > 1 ? "s" : ""}, {veilleResult.ignores} déjà connu
              {veilleResult.ignores > 1 ? "s" : ""}.
            </p>
          )}
          {veilleResult?.error && (
            <p className="text-xs text-red-400">Erreur : {veilleResult.error}</p>
          )}
        </div>
      </header>

      {/* Dossiers */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Chargement des dossiers…</p>
      ) : dossiers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] px-8 py-16 text-center">
          <p className="font-display text-xl">Aucune source pour l&apos;instant</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Lance la veille automatique ou capture une source manuellement pour peupler
            ton second cerveau.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {dossiers.map((d) => {
            const intensity = 0.25 + 0.75 * (d.count / maxCount);
            return (
              <Link
                key={d.nom}
                href={`/dossiers/${encodeURIComponent(d.nom)}`}
                className="glow-node group relative rounded-2xl p-6"
                style={{
                  background: "var(--bg-elevated)",
                  boxShadow: `0 0 ${24 * intensity}px ${8 * intensity}px rgba(124, 111, 239, ${0.12 * intensity})`,
                }}
              >
                <div
                  className="mb-4 h-2 w-2 rounded-full"
                  style={{
                    background: "var(--accent)",
                    boxShadow: `0 0 ${10 * intensity}px ${3 * intensity}px var(--accent)`,
                  }}
                />
                <h2 className="font-display text-lg font-medium">{d.nom}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {d.count} article{d.count > 1 ? "s" : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}