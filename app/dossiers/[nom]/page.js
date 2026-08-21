"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const HUMEUR_LABELS = {
  tres_positif: { label: "Très positif", color: "#5FCF9C" },
  positif: { label: "Positif", color: "#8FE0B8" },
  mitige: { label: "Mitigé", color: "#E9A23B" },
  negatif: { label: "Négatif", color: "#EF6F8E" },
  tres_negatif: { label: "Très négatif", color: "#D94F6E" },
};

export default function DossierPage() {
  const params = useParams();
  const nomDossier = decodeURIComponent(params.nom);

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [newTag, setNewTag] = useState({});
  const [newReaction, setNewReaction] = useState({});
  const [analyzing, setAnalyzing] = useState({});

  useEffect(() => {
    fetchArticles();
  }, [nomDossier]);

  async function fetchArticles() {
    setLoading(true);
    const res = await fetch(`/api/dossiers/${encodeURIComponent(nomDossier)}`);
    const data = await res.json();
    setArticles(data.articles ?? []);
    setLoading(false);
  }

  async function ajouterTag(articleId) {
    const nom = (newTag[articleId] ?? "").trim();
    if (!nom) return;
    await fetch(`/api/articles/${articleId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom }),
    });
    setNewTag((prev) => ({ ...prev, [articleId]: "" }));
    fetchArticles();
  }

  async function retirerTag(articleId, tagId) {
    await fetch(`/api/articles/${articleId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    fetchArticles();
  }

  async function ajouterReaction(articleId) {
    const contenu = (newReaction[articleId] ?? "").trim();
    if (!contenu) return;
    await fetch(`/api/articles/${articleId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenu }),
    });
    setNewReaction((prev) => ({ ...prev, [articleId]: "" }));
    fetchArticles();
  }

  async function analyserPertinence(articleId) {
    setAnalyzing((prev) => ({ ...prev, [articleId]: true }));
    try {
      await fetch(`/api/articles/${articleId}/reactions`, { method: "PUT" });
      await fetchArticles();
    } finally {
      setAnalyzing((prev) => ({ ...prev, [articleId]: false }));
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

      <h1 className="font-display mb-2 text-4xl font-semibold">{nomDossier}</h1>
      <p className="mb-12 text-sm text-[var(--text-muted)]">
        {articles.length} article{articles.length > 1 ? "s" : ""}
      </p>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {articles.map((a) => {
            const repub = JSON.parse(a.republicationJson);
            const isOpen = openId === a.id;
            const humeurInfo = a.humeur ? HUMEUR_LABELS[a.humeur] : null;

            return (
              <div
                key={a.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-display text-lg font-medium">
                      {a.titre}
                    </h2>
                    <div className="flex shrink-0 items-center gap-2">
                      {humeurInfo && (
                        <span
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{
                            background: `${humeurInfo.color}22`,
                            color: humeurInfo.color,
                          }}
                        >
                          {humeurInfo.label}
                        </span>
                      )}
                      <span className="whitespace-nowrap rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        {a.categorie}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {a.interet}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {a.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="group flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs text-[var(--accent)]"
                    >
                      {tag.nom}
                      <button
                        onClick={() => retirerTag(a.id, tag.id)}
                        className="opacity-50 transition hover:opacity-100"
                        aria-label={`Retirer le tag ${tag.nom}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    placeholder="+ tag"
                    value={newTag[a.id] ?? ""}
                    onChange={(e) =>
                      setNewTag((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && ajouterTag(a.id)}
                    className="w-20 rounded-full border border-dashed border-[var(--border)] bg-transparent px-3 py-1 text-xs outline-none focus:border-[var(--accent)]"
                  />
                </div>

                {isOpen && (
                  <div className="mt-5 flex flex-col gap-4">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                      <p className="mb-1 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        Republication suggérée · {repub.format_suggere}
                      </p>
                      <p className="font-display mb-2 text-base">
                        {repub.accroche}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {repub.corps}
                      </p>
                      <p className="mt-3 text-xs text-[var(--text-muted)]">
                        Valeur ajoutée : {a.valeurAjoutee}
                      </p>
                      {a.source?.url && (
                        <a
                          href={a.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline"
                        >
                          Voir la source →
                        </a>
                      )}
                    </div>

                    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                      <p className="mb-3 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                        Pertinence · réactions collectées
                      </p>

                      {a.humeurSynthese && (
                        <p className="mb-4 text-sm text-[var(--text)]">
                          {a.humeurSynthese}
                        </p>
                      )}

                      {a.reactions?.length > 0 && (
                        <ul className="mb-4 flex flex-col gap-1.5">
                          {a.reactions.map((r) => (
                            <li
                              key={r.id}
                              className="rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]"
                            >
                              {r.contenu}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Coller un commentaire/réaction reçu…"
                          value={newReaction[a.id] ?? ""}
                          onChange={(e) =>
                            setNewReaction((prev) => ({
                              ...prev,
                              [a.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) =>
                            e.key === "Enter" && ajouterReaction(a.id)
                          }
                          className="flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                        />
                        <button
                          onClick={() => ajouterReaction(a.id)}
                          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:text-[var(--text)]"
                        >
                          Ajouter
                        </button>
                      </div>

                      {a.reactions?.length > 0 && (
                        <button
                          onClick={() => analyserPertinence(a.id)}
                          disabled={analyzing[a.id]}
                          className="mt-3 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {analyzing[a.id]
                            ? "Analyse en cours…"
                            : "Analyser la pertinence"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
