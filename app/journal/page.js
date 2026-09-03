"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function JournalPage() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/journal")
      .then((res) => res.json())
      .then((data) => {
        setActions(data.actions ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
      <Link
        href="/"
        className="focus-mark mb-10 inline-block text-sm text-[var(--paper-dim)] transition hover:text-[var(--paper)]"
      >
        ← Retour aux dossiers
      </Link>

      <h1 className="hero-title mb-3 text-4xl font-bold md:text-5xl">
        De la veille à l&apos;action
      </h1>
      <p className="mb-14 max-w-lg text-sm text-[var(--paper-dim)]">
        {actions.length} action{actions.length > 1 ? "s" : ""} liée
        {actions.length > 1 ? "s" : ""} à un projet ou une décision, la plus récente en
        premier.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--paper-dim)]">Chargement…</p>
      ) : actions.length === 0 ? (
        <div className="bg-[var(--surface)] px-8 py-20 text-center">
          <p className="hero-title text-2xl font-bold text-[var(--azul)]">
            Aucune action liée pour l&apos;instant
          </p>
          <p className="mt-3 text-sm text-[var(--azul-dim)]">
            Depuis un article, clique sur &quot;Marquer comme appliqué&quot; pour relier
            une source de veille à un projet ou une décision réelle.
          </p>
        </div>
      ) : (
        <div className="relative flex flex-col gap-1 pl-6">
          <div className="absolute top-1 bottom-1 left-[3px] w-[3px] bg-[var(--terra-dim)]" />
          {actions.map((act) => (
            <div key={act.id} className="relative">
              <div
                className="absolute top-2 -left-6 h-2.5 w-2.5"
                style={{ background: "var(--terra)" }}
              />
              <div className="bg-[var(--surface)] p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="bg-[var(--terra)] px-3 py-1 text-xs font-medium text-[var(--paper)]">
                    {act.projet.nom}
                  </span>
                  <span className="text-xs text-[var(--azul-dim)]">
                    {new Date(act.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                <Link
                  href={`/dossiers/${encodeURIComponent(act.article.dossier)}`}
                  className="focus-mark font-display mt-3 block text-base font-bold text-[var(--azul)] hover:text-[var(--terra)]"
                >
                  {act.article.titre}
                </Link>
                <p className="mt-2 text-sm text-[var(--azul-dim)]">{act.impact}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
