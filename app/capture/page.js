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
                body: JSON.stringify({ url: url || undefined, type, rawContent }),
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
                className="mb-8 inline-block text-sm text-[var(--text-muted)] transition hover:text-[var(--accent)]"
            >
                ← Retour aux dossiers
            </Link>

            <h1 className="font-display mb-2 text-4xl font-semibold">Capturer une source</h1>
            <p className="mb-10 max-w-lg text-sm text-[var(--text-muted)]">
                Colle un article, une vidéo, un post, ou une idée attrapée à la volée. L&apos;agent
                s&apos;occupe de qualifier, ranger et proposer une republication.
            </p>

            <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
                <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        URL (optionnel)
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    />
                </div>

                <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        Nature de la source
                    </label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    >
                        <option value="article">Article</option>
                        <option value="video">Vidéo</option>
                        <option value="post_reseau_social">Post réseau social</option>
                        <option value="note_terrain">Note terrain</option>
                        <option value="autre">Autre</option>
                    </select>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        Contenu
                    </label>
                    <textarea
                        value={rawContent}
                        onChange={(e) => setRawContent(e.target.value)}
                        required
                        rows={8}
                        placeholder="Colle le texte de l'article, la transcription, ou décris ton idée…"
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !rawContent.trim()}
                    className="self-start rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {loading ? "Qualification en cours…" : "Capturer"}
                </button>
            </form>

            {error && (
                <p className="mt-6 max-w-xl text-sm text-red-400">{error}</p>
            )}

            {result && (
                <div className="mt-8 max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
                    <p className="mb-1 text-xs uppercase tracking-wide text-[var(--success)]">
                        Rangé dans « {result.dossierSuggere} »
                    </p>
                    <p className="font-display mb-2 text-lg">{result.republication.accroche}</p>
                    <p className="text-sm text-[var(--text-muted)]">{result.republication.corps}</p>
                    <Link
                        href={`/dossiers/${encodeURIComponent(result.dossierSuggere)}`}
                        className="mt-4 inline-block text-xs text-[var(--accent)] hover:underline"
                    >
                        Voir le dossier →
                    </Link>
                </div>
            )}
        </main>
    );
}