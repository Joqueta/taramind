"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";

// Ordre fixe des dossiers -> slot catégoriel fixe (jamais recalculé par valeur,
// jamais cyclé). Palette terreuse alignée sur la DA (Terra Queimada / Azul en
// tête, puis variations olive/ocre/ardoise pour les dossiers suivants).
const DOSSIER_ORDER = ["IA", "Automatisation", "Design", "Culture", "Business", "Non classé"];
const CATEGORICAL = [
  "#754437", "#28374a", "#6b7c4f", "#b08a3e", "#4a6670", "#9c5b4a", "#5c4a6b", "#8a8567",
];

function colorFor(dossier) {
  const idx = DOSSIER_ORDER.indexOf(dossier);
  return CATEGORICAL[(idx === -1 ? DOSSIER_ORDER.length : idx) % CATEGORICAL.length];
}

const WIDTH = 760;
const HEIGHT = 320;
const PAD_LEFT = 34;
const PAD_RIGHT = 96;
const PAD_TOP = 20;
const PAD_BOTTOM = 32;
const PLOT_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const PLOT_H = HEIGHT - PAD_TOP - PAD_BOTTOM;
const SCORE_MIN = 1;
const SCORE_MAX = 5;

function yFor(score) {
  return PAD_TOP + (1 - (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * PLOT_H;
}

export default function TendancesPage() {
  const [data, setData] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    fetchTendances();
  }, []);

  async function fetchTendances() {
    const res = await fetch("/api/tendances");
    setData(await res.json());
  }

  async function calculerScoresManquants() {
    setEvaluating(true);
    try {
      await fetch("/api/interet/backfill", { method: "POST" });
      await fetchTendances();
    } finally {
      setEvaluating(false);
    }
  }

  const semaines = useMemo(
    () => (data ? data.serieParSemaine.map((s) => s.semaine) : []),
    [data]
  );

  const dossiers = useMemo(() => {
    if (!data) return [];
    const set = new Set();
    for (const s of data.serieParSemaine) {
      for (const d of Object.keys(s.parDossier)) set.add(d);
    }
    return [...set].sort((a, b) => {
      const ia = DOSSIER_ORDER.indexOf(a);
      const ib = DOSSIER_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [data]);

  const xFor = (i) =>
    semaines.length <= 1
      ? PAD_LEFT + PLOT_W / 2
      : PAD_LEFT + (i / (semaines.length - 1)) * PLOT_W;

  // Points + segments de ligne (avec coupures là où un dossier n'a pas de
  // données cette semaine-là, plutôt que de tomber à zéro).
  const lignes = useMemo(() => {
    if (!data) return [];
    return dossiers.map((dossier) => {
      const points = data.serieParSemaine.map((s, i) => {
        const v = s.parDossier[dossier];
        return v === undefined ? null : { i, x: xFor(i), y: yFor(v), v };
      });
      const segments = [];
      let courant = [];
      for (const p of points) {
        if (p === null) {
          if (courant.length > 1) segments.push(courant);
          courant = [];
        } else {
          courant.push(p);
        }
      }
      if (courant.length > 1) segments.push(courant);
      const dernierPoint = [...points].reverse().find((p) => p !== null);
      return { dossier, points, segments, dernierPoint };
    });
  }, [data, dossiers, semaines]);

  // Répartit les étiquettes de fin de ligne pour qu'elles ne se chevauchent pas
  const etiquettesFin = useMemo(() => {
    const brutes = lignes
      .filter((l) => l.dernierPoint)
      .map((l) => ({ dossier: l.dossier, x: l.dernierPoint.x, y: l.dernierPoint.y }))
      .sort((a, b) => a.y - b.y);
    const MIN_GAP = 16;
    for (let i = 1; i < brutes.length; i++) {
      if (brutes[i].y - brutes[i - 1].y < MIN_GAP) {
        brutes[i].y = brutes[i - 1].y + MIN_GAP;
      }
    }
    return brutes;
  }, [lignes]);

  function onPointerMove(e) {
    if (semaines.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let plusProche = 0;
    let meilleureDistance = Infinity;
    for (let i = 0; i < semaines.length; i++) {
      const d = Math.abs(xFor(i) - relX);
      if (d < meilleureDistance) {
        meilleureDistance = d;
        plusProche = i;
      }
    }
    setHoverIndex(plusProche);
  }

  const semaineHover = hoverIndex !== null ? data?.serieParSemaine[hoverIndex] : null;

  return (
    <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
      <Link
        href="/"
        className="focus-mark mb-10 inline-block text-sm text-[var(--paper-dim)] transition hover:text-[var(--paper)]"
      >
        ← Retour aux dossiers
      </Link>

      <h1 className="hero-title mb-3 text-4xl font-bold md:text-5xl">
        Timeline des tendances
      </h1>
      <p className="mb-14 max-w-lg text-sm text-[var(--paper-dim)]">
        Évolution de la pertinence par dossier dans le temps — le retour du public
        (réactions analysées) quand il existe, sinon le score d&apos;intérêt calculé
        par l&apos;agent à l&apos;ingestion.
      </p>

      {!data ? (
        <p className="text-sm text-[var(--paper-dim)]">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="bg-[var(--surface)] p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                Pertinence moyenne par semaine et par dossier
              </p>
              {data.sansScore > 0 && (
                <button
                  onClick={calculerScoresManquants}
                  disabled={evaluating}
                  className="focus-mark bg-[var(--azul)] px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--terra)] disabled:opacity-50"
                >
                  {evaluating
                    ? "Calcul en cours…"
                    : `Calculer les scores manquants (${data.sansScore})`}
                </button>
              )}
            </div>

            {semaines.length === 0 ? (
              <p className="text-sm text-[var(--azul-dim)]">
                Pas encore assez d&apos;articles avec un score de pertinence.
              </p>
            ) : (
              <>
                <div className="relative">
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="w-full"
                    style={{ maxHeight: HEIGHT }}
                    onPointerMove={onPointerMove}
                    onPointerLeave={() => setHoverIndex(null)}
                  >
                    {/* Gridlines horizontales, une par note entière */}
                    {[1, 2, 3, 4, 5].map((v) => (
                      <g key={v}>
                        <line
                          x1={PAD_LEFT}
                          x2={WIDTH - PAD_RIGHT}
                          y1={yFor(v)}
                          y2={yFor(v)}
                          stroke="var(--surface-dim)"
                          strokeWidth={1}
                        />
                        <text
                          x={PAD_LEFT - 8}
                          y={yFor(v) + 3}
                          textAnchor="end"
                          fontSize="10"
                          fill="var(--azul-dim)"
                        >
                          {v}
                        </text>
                      </g>
                    ))}

                    {/* Crosshair */}
                    {hoverIndex !== null && (
                      <line
                        x1={xFor(hoverIndex)}
                        x2={xFor(hoverIndex)}
                        y1={PAD_TOP}
                        y2={HEIGHT - PAD_BOTTOM}
                        stroke="var(--azul-dim)"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Lignes par dossier */}
                    {lignes.map(({ dossier, points, segments }) => (
                      <g key={dossier}>
                        {segments.map((seg, i) => (
                          <path
                            key={i}
                            d={seg
                              .map((p, j) => `${j === 0 ? "M" : "L"}${p.x},${p.y}`)
                              .join(" ")}
                            fill="none"
                            stroke={colorFor(dossier)}
                            strokeWidth={2}
                            strokeLinecap="butt"
                            strokeLinejoin="miter"
                          />
                        ))}
                        {points.map(
                          (p) =>
                            p && (
                              <rect
                                key={p.i}
                                x={p.x - 3.5}
                                y={p.y - 3.5}
                                width={7}
                                height={7}
                                fill={colorFor(dossier)}
                                stroke="var(--surface)"
                                strokeWidth={2}
                              />
                            )
                        )}
                      </g>
                    ))}

                    {/* Étiquettes de fin de ligne, avec ligne de rappel en équerre si décalées */}
                    {etiquettesFin.map((e) => {
                      const trueY = lignes.find((l) => l.dossier === e.dossier).dernierPoint.y;
                      const edgeX = WIDTH - PAD_RIGHT + 4;
                      const decale = Math.abs(e.y - trueY) > 1;
                      return (
                        <g key={e.dossier}>
                          {decale && (
                            <path
                              d={`M${e.x},${trueY} H${edgeX} V${e.y}`}
                              fill="none"
                              stroke="var(--azul-dim)"
                              strokeWidth={1}
                              opacity={0.5}
                            />
                          )}
                          <text
                            x={edgeX + 6}
                            y={e.y + 3}
                            fontSize="11"
                            fill="var(--azul-dim)"
                          >
                            {e.dossier}
                          </text>
                        </g>
                      );
                    })}

                    {/* Axe des semaines */}
                    {semaines.map((s, i) => (
                      <text
                        key={s}
                        x={xFor(i)}
                        y={HEIGHT - 10}
                        textAnchor="middle"
                        fontSize="10"
                        fill="var(--azul-dim)"
                      >
                        {new Date(s).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </text>
                    ))}
                  </svg>

                  {semaineHover && (
                    <div
                      className="pointer-events-none absolute top-2 bg-[var(--surface-dim)] px-3 py-2 text-xs"
                      style={{
                        left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
                        transform:
                          xFor(hoverIndex) > WIDTH * 0.6
                            ? "translateX(-105%)"
                            : "translateX(12px)",
                      }}
                    >
                      <p className="mb-1.5 font-medium text-[var(--azul)]">
                        {new Date(semaineHover.semaine).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "long",
                        })}
                      </p>
                      {dossiers
                        .filter((d) => semaineHover.parDossier[d] !== undefined)
                        .map((d) => (
                          <div key={d} className="flex items-center gap-2">
                            <span
                              className="h-0.5 w-3 shrink-0"
                              style={{ background: colorFor(d) }}
                            />
                            <span className="text-[var(--azul-dim)]">{d}</span>
                            <span className="ml-auto font-medium text-[var(--azul)]">
                              {semaineHover.parDossier[d]}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Légende */}
                <div className="mt-5 flex flex-wrap gap-4">
                  {dossiers.map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1.5 text-xs text-[var(--azul-dim)]"
                    >
                      <span className="h-0.5 w-3" style={{ background: colorFor(d) }} />
                      {d}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="bg-[var(--surface)] p-6">
            <p className="mb-5 text-xs uppercase tracking-wide text-[var(--azul-dim)]">
              Top tendance · moyenne de pertinence, tous les articles
            </p>

            {data.classement.length === 0 ? (
              <p className="text-sm text-[var(--azul-dim)]">
                Pas encore de score de pertinence à classer.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {data.classement.map((c, i) => (
                  <li key={c.dossier} className="flex items-center gap-3">
                    <span className="w-4 text-xs text-[var(--azul-dim)]">
                      {i + 1}
                    </span>
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ background: colorFor(c.dossier) }}
                    />
                    <span className="w-32 shrink-0 truncate text-sm font-medium text-[var(--azul)]">
                      {c.dossier}
                    </span>
                    <div className="h-2 flex-1 bg-[var(--surface-dim)]">
                      <div
                        className="h-full"
                        style={{
                          width: `${((c.moyenne - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%`,
                          background: colorFor(c.dossier),
                        }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-[var(--azul-dim)]">
                      {c.moyenne} / 5 · {c.nbArticles} art.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
