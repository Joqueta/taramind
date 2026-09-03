import { prisma } from "@/lib/prisma";

// Convertit l'humeur (analyse manuelle des réactions) sur l'échelle 1-5,
// cohérente avec interetScore, pour pouvoir les combiner.
const HUMEUR_VERS_SCORE = {
    tres_negatif: 1,
    negatif: 2,
    mitige: 3,
    positif: 4,
    tres_positif: 5,
};

// Lundi 00:00 de la semaine contenant `date`
function debutSemaine(date) {
    const d = new Date(date);
    const jour = d.getDay();
    const diff = (jour === 0 ? -6 : 1) - jour;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Le score de pertinence effectif d'un article : l'humeur (retour réel du
// public) prime quand elle existe, sinon le score d'intérêt du LLM sert de
// repli pour ne jamais laisser un article sans signal.
function pertinenceEffective(article) {
    if (article.humeur && HUMEUR_VERS_SCORE[article.humeur] !== undefined) {
        return HUMEUR_VERS_SCORE[article.humeur];
    }
    return article.interetScore ?? null;
}

export async function GET() {
    try {
        const articles = await prisma.article.findMany({
            select: {
                dossier: true,
                createdAt: true,
                humeur: true,
                interetScore: true,
            },
        });

        const scores = articles
            .map((a) => ({ ...a, score: pertinenceEffective(a) }))
            .filter((a) => a.score !== null);

        const sansScore = articles.length - scores.length;

        // --- Moyenne de pertinence par dossier et par semaine ---
        const parSemaineDossier = {};
        for (const a of scores) {
            const semaine = debutSemaine(a.createdAt).toISOString();
            parSemaineDossier[semaine] ??= {};
            parSemaineDossier[semaine][a.dossier] ??= { somme: 0, n: 0 };
            parSemaineDossier[semaine][a.dossier].somme += a.score;
            parSemaineDossier[semaine][a.dossier].n += 1;
        }

        const serieParSemaine = Object.entries(parSemaineDossier)
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([semaine, parDossier]) => ({
                semaine,
                parDossier: Object.fromEntries(
                    Object.entries(parDossier).map(([d, { somme, n }]) => [
                        d,
                        Math.round((somme / n) * 100) / 100,
                    ])
                ),
            }));

        // --- Classement "top tendance" : moyenne globale par dossier ---
        const parDossierGlobal = {};
        for (const a of scores) {
            parDossierGlobal[a.dossier] ??= { somme: 0, n: 0 };
            parDossierGlobal[a.dossier].somme += a.score;
            parDossierGlobal[a.dossier].n += 1;
        }
        const classement = Object.entries(parDossierGlobal)
            .map(([dossier, { somme, n }]) => ({
                dossier,
                moyenne: Math.round((somme / n) * 100) / 100,
                nbArticles: n,
            }))
            .sort((a, b) => b.moyenne - a.moyenne);

        return Response.json({ serieParSemaine, classement, sansScore });
    } catch (err) {
        console.error("Erreur GET tendances :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
