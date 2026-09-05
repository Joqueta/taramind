"use client";

import { useState } from "react";
import Link from "next/link";

export default function CapturePage() {
    const [url, setUrl] = useState("");
    const [type, setType] = useState("article");
    const [rawContent, setRawContent] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const res = await fetch("/api/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: url || undefined,
                    type,
                    rawContent: url.trim() ? undefined : rawContent,
                }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Erreur inconnue");
            } else if (data.skipped) {
                setError("Cette URL est déjà présente dans la base.");
            } else {
                setResult(data);
                setUrl("");
                setRawContent("");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
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

            <h1 className="hero-title mb-3 text-4xl font-bold md:text-5xl">Capturer une source</h1>
            <p className="mb-12 max-w-lg text-sm text-[var(--paper-dim)]">
                Colle un article, une vidéo, un post, ou une idée attrapée à la volée. L&apos;agent
                s&apos;occupe de qualifier, ranger et proposer une republication.
            </p>

            <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-1">
                <div className="bg-[var(--surface)] p-5">
                    <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                        URL (optionnel)
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://..."
                        className="focus-mark w-full bg-[var(--surface-dim)] px-4 py-3 text-sm text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                    />
                </div>

                <div className="bg-[var(--surface)] p-5">
                    <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                        Nature de la source
                    </label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="focus-mark w-full bg-[var(--surface-dim)] px-4 py-3 text-sm text-[var(--azul)]"
                    >
                        <option value="article">Article</option>
                        <option value="video">Vidéo</option>
                        <option value="post_reseau_social">Post réseau social</option>
                        <option value="note_terrain">Note terrain</option>
                        <option value="autre">Autre</option>
                    </select>
                </div>

                {!url.trim() && (
                    <div className="bg-[var(--surface)] p-5">
                        <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                            Contenu
                        </label>
                        <textarea
                            value={rawContent}
                            onChange={(e) => setRawContent(e.target.value)}
                            required
                            rows={8}
                            placeholder="Colle le texte de l'article, la transcription, ou décris ton idée…"
                            className="focus-mark w-full resize-none bg-[var(--surface-dim)] px-4 py-3 text-sm text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || (!url.trim() && !rawContent.trim())}
                    className="focus-mark mt-4 self-start bg-[var(--terra)] px-6 py-3 text-sm font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--azul)] disabled:opacity-50"
                >
                    {loading ? "Qualification en cours…" : "Capturer"}
                </button>
            </form>

            {error && (
                <p className="mt-6 max-w-xl text-sm text-[var(--bad)]">{error}</p>
            )}

            {result && (
                <div className="mt-10 max-w-xl bg-[var(--surface)] p-6">
                    <p className="mb-2 text-xs uppercase tracking-wide text-[var(--ok)]">
                        Rangé dans « {result.dossierSuggere} »
                    </p>
                    <p className="font-display mb-2 text-lg font-bold text-[var(--azul)]">{result.republication.accroche}</p>
                    <p className="text-sm text-[var(--azul-dim)]">{result.republication.corps}</p>
                    <Link
                        href={`/dossiers/${encodeURIComponent(result.dossierSuggere)}`}
                        className="focus-mark mt-4 inline-block text-xs font-medium text-[var(--terra)] underline underline-offset-4"
                    >
                        Voir le dossier →
                    </Link>
                </div>
            )}
        </main>
    );
}
