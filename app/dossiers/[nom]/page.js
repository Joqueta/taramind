"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const HUMEUR_LABELS = {
  tres_positif: { label: "Très positif", color: "var(--ok)" },
  positif: { label: "Positif", color: "var(--ok-soft)" },
  mitige: { label: "Mitigé", color: "var(--warn)" },
  negatif: { label: "Négatif", color: "var(--bad)" },
  tres_negatif: { label: "Très négatif", color: "var(--bad-soft)" },
};

const LEGITIMITE_LABELS = {
  fiable: { label: "Fiable", color: "var(--ok)" },
  a_verifier: { label: "À vérifier", color: "var(--warn)" },
  douteux: { label: "Douteux", color: "var(--bad)" },
  non_evalue: { label: "Non évalué", color: "var(--neutral)" },
};

function niveauDe(article) {
  const niveau = article.source?.legitimiteNiveau;
  return niveau && LEGITIMITE_LABELS[niveau] ? niveau : "non_evalue";
}

export default function DossierPage() {
  const params = useParams();
  const nomDossier = decodeURIComponent(params.nom);

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [newTag, setNewTag] = useState({});
  const [newReaction, setNewReaction] = useState({});
  const [analyzing, setAnalyzing] = useState({});
  const [deleting, setDeleting] = useState({});
  const [projets, setProjets] = useState([]);
  const [newAction, setNewAction] = useState({});
  const [filtreNiveau, setFiltreNiveau] = useState("tous");

  useEffect(() => {
    fetchArticles();
    fetch("/api/projets")
      .then((res) => res.json())
      .then((data) => setProjets(data.projets ?? []));
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

  async function ajouterAction(articleId) {
    const projet = (newAction[articleId]?.projet ?? "").trim();
    const impact = (newAction[articleId]?.impact ?? "").trim();
    if (!projet || !impact) return;
    await fetch(`/api/articles/${articleId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projet, impact }),
    });
    setNewAction((prev) => ({ ...prev, [articleId]: { projet: "", impact: "" } }));
    await fetchArticles();
    if (!projets.some((p) => p.nom === projet)) {
      fetch("/api/projets")
        .then((res) => res.json())
        .then((data) => setProjets(data.projets ?? []));
    }
  }

  async function retirerAction(articleId, actionId) {
    await fetch(`/api/articles/${articleId}/actions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId }),
    });
    fetchArticles();
  }

  async function supprimerArticle(articleId) {
    if (!confirm("Supprimer définitivement cet article ?")) return;
    setDeleting((prev) => ({ ...prev, [articleId]: true }));
    try {
      await fetch(`/api/articles/${articleId}`, { method: "DELETE" });
      setArticles((prev) => prev.filter((a) => a.id !== articleId));
    } finally {
      setDeleting((prev) => ({ ...prev, [articleId]: false }));
    }
  }

  const articlesAffiches =
    filtreNiveau === "tous"
      ? articles
      : articles.filter((a) => niveauDe(a) === filtreNiveau);

  return (
    <main className="min-h-screen px-6 py-12 md:px-16 md:py-20">
      <Link
        href="/"
        className="focus-mark mb-10 inline-block text-sm text-[var(--paper-dim)] transition hover:text-[var(--paper)]"
      >
        ← Retour aux dossiers
      </Link>

      <h1 className="hero-title mb-3 text-4xl font-bold md:text-5xl">{nomDossier}</h1>
      <div className="mb-14 flex flex-wrap items-center gap-5">
        <p className="text-sm text-[var(--paper-dim)]">
          {articlesAffiches.length} article{articlesAffiches.length > 1 ? "s" : ""}
        </p>
        <select
          value={filtreNiveau}
          onChange={(e) => setFiltreNiveau(e.target.value)}
          className="focus-mark bg-[var(--surface)] px-3 py-2 text-xs text-[var(--azul)]"
        >
          <option value="tous">Tous les niveaux</option>
          {Object.entries(LEGITIMITE_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--paper-dim)]">Chargement…</p>
      ) : (
        <div className="flex flex-col gap-1">
          {articlesAffiches.map((a) => {
            const repub = JSON.parse(a.republicationJson);
            const isOpen = openId === a.id;
            const humeurInfo = a.humeur ? HUMEUR_LABELS[a.humeur] : null;
            const legitimiteInfo = LEGITIMITE_LABELS[niveauDe(a)];

            return (
              <div
                key={a.id}
                className="bg-[var(--surface)] p-6"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-display text-lg font-bold text-[var(--azul)]">
                      {a.titre}
                    </h2>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                      {humeurInfo && (
                        <span
                          className="px-3 py-1 text-xs font-medium text-[var(--paper)]"
                          style={{ background: humeurInfo.color }}
                        >
                          {humeurInfo.label}
                        </span>
                      )}
                      <span
                        className="whitespace-nowrap px-3 py-1 text-xs font-medium text-[var(--paper)]"
                        style={{ background: legitimiteInfo.color }}
                        title={a.source?.legitimite}
                      >
                        {legitimiteInfo.label}
                      </span>
                      <span className="whitespace-nowrap bg-[var(--surface-dim)] px-3 py-1 text-xs text-[var(--azul-dim)]">
                        {a.categorie}
                      </span>
                      <span className="whitespace-nowrap px-2 py-1 text-xs text-[var(--azul-dim)]">
                        {new Date(a.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          supprimerArticle(a.id);
                        }}
                        disabled={deleting[a.id]}
                        className="focus-mark whitespace-nowrap px-3 py-1 text-xs text-[var(--azul-dim)] transition hover:bg-[var(--bad)] hover:text-[var(--paper)] disabled:opacity-50"
                        aria-label="Supprimer l'article"
                      >
                        {deleting[a.id] ? "…" : "Supprimer"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-[var(--azul-dim)]">
                    {a.interet}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-1">
                  {a.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="group flex items-center gap-1.5 bg-[var(--terra)] px-3 py-1 text-xs text-[var(--paper)]"
                    >
                      {tag.nom}
                      <button
                        onClick={() => retirerTag(a.id, tag.id)}
                        className="opacity-60 transition hover:opacity-100"
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
                    className="focus-mark w-20 bg-[var(--surface-dim)] px-3 py-1 text-xs text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                  />
                </div>

                {isOpen && (
                  <div className="mt-6 flex flex-col gap-1">
                    <div className="bg-[var(--surface-dim)] p-5">
                      <p className="mb-1 text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                        Republication suggérée · {repub.format_suggere}
                      </p>
                      <p className="font-display mb-2 text-base font-bold text-[var(--azul)]">
                        {repub.accroche}
                      </p>
                      <p className="text-sm text-[var(--azul-dim)]">
                        {repub.corps}
                      </p>
                      <p className="mt-3 text-xs text-[var(--azul-dim)]">
                        Valeur ajoutée : {a.valeurAjoutee}
                      </p>
                      {a.source?.url && (
                        <a
                          href={a.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="focus-mark mt-3 inline-block text-xs font-medium text-[var(--terra)] underline underline-offset-4"
                        >
                          Voir la source →
                        </a>
                      )}
                    </div>

                    <div className="bg-[var(--surface-dim)] p-5">
                      <p className="mb-3 text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                        Pertinence · réactions collectées
                      </p>

                      {a.humeurSynthese && (
                        <p className="mb-4 text-sm text-[var(--azul)]">
                          {a.humeurSynthese}
                        </p>
                      )}

                      {a.reactions?.length > 0 && (
                        <ul className="mb-4 flex flex-col gap-1">
                          {a.reactions.map((r) => (
                            <li
                              key={r.id}
                              className="bg-[var(--surface)] px-3 py-2 text-xs text-[var(--azul-dim)]"
                            >
                              {r.contenu}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex gap-1">
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
                          className="focus-mark flex-1 bg-[var(--surface)] px-3 py-2 text-xs text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                        />
                        <button
                          onClick={() => ajouterReaction(a.id)}
                          className="focus-mark bg-[var(--surface)] px-3 py-2 text-xs text-[var(--azul-dim)] transition hover:text-[var(--azul)]"
                        >
                          Ajouter
                        </button>
                      </div>

                      {a.reactions?.length > 0 && (
                        <button
                          onClick={() => analyserPertinence(a.id)}
                          disabled={analyzing[a.id]}
                          className="focus-mark mt-3 bg-[var(--terra)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--azul)] disabled:opacity-50"
                        >
                          {analyzing[a.id]
                            ? "Analyse en cours…"
                            : "Analyser la pertinence"}
                        </button>
                      )}
                    </div>

                    <div className="bg-[var(--surface-dim)] p-5">
                      <p className="mb-3 text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                        Veille → Action
                      </p>

                      {a.actions?.length > 0 && (
                        <ul className="mb-4 flex flex-col gap-1">
                          {a.actions.map((act) => (
                            <li
                              key={act.id}
                              className="bg-[var(--surface)] px-3 py-2 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-[var(--terra)]">
                                  {act.projet.nom}
                                </span>
                                <div className="flex shrink-0 items-center gap-2">
                                  <span className="whitespace-nowrap text-[var(--azul-dim)]">
                                    {new Date(act.createdAt).toLocaleDateString("fr-FR")}
                                  </span>
                                  <button
                                    onClick={() => retirerAction(a.id, act.id)}
                                    className="opacity-60 transition hover:opacity-100"
                                    aria-label="Retirer cette action"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                              <p className="mt-1 text-[var(--azul-dim)]">{act.impact}</p>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-col gap-1">
                        <input
                          type="text"
                          list="projets-list"
                          placeholder="Projet ou décision…"
                          value={newAction[a.id]?.projet ?? ""}
                          onChange={(e) =>
                            setNewAction((prev) => ({
                              ...prev,
                              [a.id]: { ...prev[a.id], projet: e.target.value },
                            }))
                          }
                          className="focus-mark bg-[var(--surface)] px-3 py-2 text-xs text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                        />
                        <textarea
                          rows={2}
                          placeholder="Impact concret (2-3 phrases)…"
                          value={newAction[a.id]?.impact ?? ""}
                          onChange={(e) =>
                            setNewAction((prev) => ({
                              ...prev,
                              [a.id]: { ...prev[a.id], impact: e.target.value },
                            }))
                          }
                          className="focus-mark resize-none bg-[var(--surface)] px-3 py-2 text-xs text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                        />
                        <button
                          onClick={() => ajouterAction(a.id)}
                          className="focus-mark mt-1 self-start bg-[var(--terra)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--paper)] transition hover:bg-[var(--azul)]"
                        >
                          Marquer comme appliqué
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <datalist id="projets-list">
        {projets.map((p) => (
          <option key={p.id} value={p.nom} />
        ))}
      </datalist>
    </main>
  );
}
