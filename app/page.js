"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const NIVEAU_LABELS = {
  fiable: { label: "Fiable", color: "var(--ok)" },
  a_verifier: { label: "À vérifier", color: "var(--warn)" },
  douteux: { label: "Douteux", color: "var(--bad)" },
  non_evalue: { label: "Non évalué", color: "var(--neutral)" },
};

function StatBars({ title, data, labels }) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <div className="bg-[var(--surface)] p-6">
      <p className="mb-4 text-xs uppercase tracking-[0.15em] text-[var(--azul-dim)]">
        {title}
      </p>
      <div className="flex flex-col gap-3">
        {entries.map(([key, n]) => {
          const info = labels?.[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs text-[var(--azul-dim)]">
                {info?.label ?? key}
              </span>
              <div className="h-2 flex-1 bg-[var(--surface-dim)]">
                <div
                  className="h-full"
                  style={{
                    width: `${(n / max) * 100}%`,
                    background: info?.color ?? "var(--terra)",
                  }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs text-[var(--azul-dim)]">
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { href: "/capture", label: "Capturer une source" },
  { href: "/carte", label: "Carte sémantique" },
  { href: "/journal", label: "Journal" },
  { href: "/tendances", label: "Tendances" },
];

export default function Home() {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [veilleRunning, setVeilleRunning] = useState(false);
  const [veilleResult, setVeilleResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState(null);

  useEffect(() => {
    fetchDossiers();
    fetchStats();
  }, []);

  async function fetchStats() {
    const res = await fetch("/api/stats");
    setStats(await res.json());
  }

  async function evaluerNonEvalues() {
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await fetch("/api/legitimite/backfill", { method: "POST" });
      const data = await res.json();
      setEvalResult(data);
      await fetchStats();
    } finally {
      setEvaluating(false);
    }
  }

  async function fetchDossiers() {
    setLoading(true);
    const res = await fetch("/api/dossiers");
    const data = await res.json();
    setDossiers(data.dossiers ?? []);
    setLoading(false);
  }

  async function envoyerDigestTest() {
    setSendingDigest(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const data = await res.json();
      setDigestResult(data);
    } catch (err) {
      setDigestResult({ error: err.message });
    } finally {
      setSendingDigest(false);
    }
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
      <header className="mb-20 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-[var(--paper-dim)]">
            Second cerveau de veille
          </p>
          <h1 className="hero-title text-6xl font-bold md:text-8xl">
            Taramind
          </h1>
          <p className="mt-4 max-w-md text-sm text-[var(--paper-dim)]">
            {total} source{total > 1 ? "s" : ""} captée{total > 1 ? "s" : ""}, qualifiée
            {total > 1 ? "s" : ""} et rangée{total > 1 ? "s" : ""} par l&apos;agent.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <nav className="flex flex-wrap gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="focus-mark px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--surface)] hover:text-[var(--azul)]"
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={lancerVeille}
              disabled={veilleRunning}
              className="focus-mark bg-[var(--terra)] px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--azul)] disabled:opacity-50"
            >
              {veilleRunning ? "Veille en cours…" : "Lancer la veille"}
            </button>
          </nav>
          {veilleResult && !veilleResult.error && (
            <p className="text-xs text-[var(--ok-soft)]">
              {veilleResult.traites} article{veilleResult.traites > 1 ? "s" : ""} traité
              {veilleResult.traites > 1 ? "s" : ""}, {veilleResult.ignores} déjà connu
              {veilleResult.ignores > 1 ? "s" : ""}.
            </p>
          )}
          {veilleResult?.error && (
            <p className="text-xs text-[var(--bad)]">Erreur : {veilleResult.error}</p>
          )}

          <button
            onClick={envoyerDigestTest}
            disabled={sendingDigest}
            className="focus-mark text-xs font-medium text-[var(--paper-dim)] underline decoration-[var(--paper-dim)] underline-offset-4 transition hover:text-[var(--paper)] disabled:opacity-50"
          >
            {sendingDigest ? "Envoi…" : "Envoyer un digest de test"}
          </button>
          {digestResult && !digestResult.error && (
            <p className="text-xs text-[var(--paper-dim)]">
              {digestResult.envoye
                ? `Digest envoyé (${digestResult.nbArticles} article${digestResult.nbArticles > 1 ? "s" : ""}).`
                : "Rien à envoyer (aucun article dans les dernières 24h)."}
            </p>
          )}
          {digestResult?.error && (
            <p className="text-xs text-[var(--bad)]">Erreur : {digestResult.error}</p>
          )}
        </div>
      </header>

      {/* Répartition des sources */}
      {stats && stats.total > 0 && (
        <div className="mb-14 grid grid-cols-1 gap-1 sm:grid-cols-2">
          <StatBars title="Sources par type" data={stats.parType} />
          <div className="flex flex-col gap-1">
            <StatBars
              title="Sources par niveau de légitimité"
              data={stats.parNiveau}
              labels={NIVEAU_LABELS}
            />
            {stats.parNiveau.non_evalue > 0 && (
              <div className="flex flex-col items-start gap-2 bg-[var(--surface)] p-6">
                <button
                  onClick={evaluerNonEvalues}
                  disabled={evaluating}
                  className="focus-mark bg-[var(--azul)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--terra)] disabled:opacity-50"
                >
                  {evaluating
                    ? "Évaluation en cours…"
                    : `Évaluer les ${stats.parNiveau.non_evalue} article${stats.parNiveau.non_evalue > 1 ? "s" : ""} non évalué${stats.parNiveau.non_evalue > 1 ? "s" : ""}`}
                </button>
                {evalResult && (
                  <p className="text-xs text-[var(--azul-dim)]">
                    {evalResult.evalues} évalué{evalResult.evalues > 1 ? "s" : ""}
                    {evalResult.erreurs > 0 && `, ${evalResult.erreurs} erreur${evalResult.erreurs > 1 ? "s" : ""}`}.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dossiers */}
      {loading ? (
        <p className="text-sm text-[var(--paper-dim)]">Chargement des dossiers…</p>
      ) : dossiers.length === 0 ? (
        <div className="bg-[var(--surface)] px-8 py-20 text-center">
          <p className="hero-title text-2xl font-bold text-[var(--azul)]">
            Aucune source pour l&apos;instant
          </p>
          <p className="mt-3 text-sm text-[var(--azul-dim)]">
            Lance la veille automatique ou capture une source manuellement pour peupler
            ton second cerveau.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {dossiers.map((d) => {
            const intensity = d.count / maxCount;
            return (
              <Link
                key={d.nom}
                href={`/dossiers/${encodeURIComponent(d.nom)}`}
                className="group relative flex flex-col justify-between bg-[var(--surface)] p-6 transition hover:bg-[var(--terra)]"
                style={{ minHeight: 140 }}
              >
                <div
                  className="h-2 w-10"
                  style={{
                    background: "var(--terra)",
                    opacity: 0.3 + 0.7 * intensity,
                  }}
                />
                <div className="mt-6 transition group-hover:text-[var(--paper)]">
                  <h2 className="font-display text-lg font-bold text-[var(--azul)] group-hover:text-[var(--paper)]">
                    {d.nom}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--azul-dim)] group-hover:text-[var(--paper-dim)]">
                    {d.count} article{d.count > 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
