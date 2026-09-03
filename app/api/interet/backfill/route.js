import { classerScoreInteret } from "@/lib/lmstudio";
import { prisma } from "@/lib/prisma";

// Note l'intérêt des articles plus anciens qui n'ont pas encore de score structuré
export async function POST() {
    try {
        const articles = await prisma.article.findMany({
            where: { interetScore: null },
            select: { id: true, interet: true },
        });

        let evalues = 0;
        let erreurs = 0;

        for (const article of articles) {
            try {
                const score = await classerScoreInteret(article.interet);
                await prisma.article.update({
                    where: { id: article.id },
                    data: { interetScore: score },
                });
                evalues++;
            } catch (err) {
                erreurs++;
                console.error(`Erreur score intérêt article ${article.id} :`, err.message);
            }
        }

        return Response.json({ evalues, erreurs, total: articles.length });
    } catch (err) {
        console.error("Erreur POST interet/backfill :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
