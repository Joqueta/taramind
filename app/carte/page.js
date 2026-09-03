"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const DOSSIER_COLORS = [
    "#754437", "#28374a", "#6b7c4f", "#b08a3e", "#4a6670", "#9c5b4a", "#5c4a6b", "#8a8567",
];

function colorFor(dossier, palette) {
    const idx = palette.indexOf(dossier);
    return DOSSIER_COLORS[idx % DOSSIER_COLORS.length];
}

export default function CartePage() {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [scores, setScores] = useState(null);
    const [searching, setSearching] = useState(false);
    const [hovered, setHovered] = useState(null);

    useEffect(() => {
        fetch("/api/carte")
            .then((res) => res.json())
            .then((data) => {
                setPoints(data.points ?? []);
                setLoading(false);
            });
    }, []);

    const dossiers = useMemo(
        () => [...new Set(points.map((p) => p.dossier))],
        [points]
    );

    const bounds = useMemo(() => {
        if (points.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        return {
            minX: Math.min(...xs), maxX: Math.max(...xs),
            minY: Math.min(...ys), maxY: Math.max(...ys),
        };
    }, [points]);

    const VIEW = 640;
    const PAD = 40;

    function project(x, y) {
        const spanX = bounds.maxX - bounds.minX || 1;
        const spanY = bounds.maxY - bounds.minY || 1;
        return {
            cx: PAD + ((x - bounds.minX) / spanX) * (VIEW - 2 * PAD),
            cy: PAD + ((y - bounds.minY) / spanY) * (VIEW - 2 * PAD),
        };
    }

    async function handleSearch(e) {
        e.preventDefault();
        if (!query.trim()) {
            setScores(null);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, topK: points.length }),
            });
            const data = await res.json();
            const map = {};
            for (const r of data.results ?? []) map[r.id] = r.score;
            setScores(map);
        } finally {
            setSearching(false);
        }
    }

    return (
        <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
            <Link
                href="/"
                className="focus-mark mb-10 inline-block text-sm text-[var(--paper-dim)] transition hover:text-[var(--paper)]"
            >
                ← Retour aux dossiers
            </Link>

            <h1 className="hero-title mb-3 text-4xl font-bold md:text-5xl">Carte sémantique</h1>
            <p className="mb-10 max-w-lg text-sm text-[var(--paper-dim)]">
                Chaque point est un article, positionné selon son sens. Les articles proches par
                le sujet se regroupent naturellement.
            </p>

            <form onSubmit={handleSearch} className="mb-10 flex max-w-lg gap-1">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Rechercher dans la base…"
                    className="focus-mark flex-1 bg-[var(--surface)] px-4 py-3 text-sm text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                />
                <button
                    type="submit"
                    disabled={searching}
                    className="focus-mark bg-[var(--terra)] px-5 py-3 text-sm font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--azul)] disabled:opacity-50"
                >
                    {searching ? "…" : "Chercher"}
                </button>
                {scores && (
                    <button
                        type="button"
                        onClick={() => { setQuery(""); setScores(null); }}
                        className="focus-mark bg-[var(--surface-dim)] px-4 py-3 text-sm text-[var(--azul-dim)] transition hover:text-[var(--azul)]"
                    >
                        Effacer
                    </button>
                )}
            </form>

            {loading ? (
                <p className="text-sm text-[var(--paper-dim)]">Calcul de la carte…</p>
            ) : points.length === 0 ? (
                <p className="text-sm text-[var(--paper-dim)]">
                    Aucun article avec embedding pour l&apos;instant.
                </p>
            ) : (
                <div className="flex flex-col gap-6 lg:flex-row">
                    <svg
                        viewBox={`0 0 ${VIEW} ${VIEW}`}
                        className="w-full max-w-[640px]"
                        style={{ background: "var(--surface)" }}
                    >
                        {points.map((p) => {
                            const { cx, cy } = project(p.x, p.y);
                            const score = scores?.[p.id];
                            const active = scores ? score !== undefined && score > 0.5 : true;
                            const r = scores && active ? 5 + score * 10 : 5;
                            return (
                                <circle
                                    key={p.id}
                                    cx={cx}
                                    cy={cy}
                                    r={r}
                                    fill={colorFor(p.dossier, dossiers)}
                                    opacity={scores ? (active ? 0.95 : 0.12) : 0.9}
                                    stroke={hovered === p.id ? "var(--azul)" : "none"}
                                    strokeWidth={2}
                                    onMouseEnter={() => setHovered(p.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    style={{ cursor: "pointer", transition: "r 0.3s ease, opacity 0.3s ease" }}
                                />
                            );
                        })}
                    </svg>

                    <div className="flex-1">
                        <div className="mb-6 flex flex-wrap gap-3">
                            {dossiers.map((d) => (
                                <span
                                    key={d}
                                    className="flex items-center gap-1.5 text-xs text-[var(--paper-dim)]"
                                >
                                    <span
                                        className="h-2.5 w-2.5"
                                        style={{ background: colorFor(d, dossiers) }}
                                    />
                                    {d}
                                </span>
                            ))}
                        </div>

                        {hovered && (
                            <div className="bg-[var(--surface)] p-5">
                                {(() => {
                                    const p = points.find((pt) => pt.id === hovered);
                                    if (!p) return null;
                                    return (
                                        <>
                                            <p className="text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                                                {p.dossier}
                                            </p>
                                            <p className="font-display mt-1 text-sm font-bold text-[var(--azul)]">{p.titre}</p>
                                            {scores?.[p.id] !== undefined && (
                                                <p className="mt-2 text-xs font-medium text-[var(--terra)]">
                                                    Pertinence : {(scores[p.id] * 100).toFixed(1)}%
                                                </p>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
