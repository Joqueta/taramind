import { prisma } from "@/lib/prisma";
import { pca2D } from "@/lib/pca";

export async function GET() {
    try {
        const articles = await prisma.article.findMany({
            where: { embedding: { not: null } },
            include: { tags: { include: { tag: true } } },
        });

        if (articles.length === 0) {
            return Response.json({ points: [] });
        }

        const vectors = articles.map((a) => JSON.parse(a.embedding));
        const coords = pca2D(vectors);

        const points = articles.map((a, i) => ({
            id: a.id,
            titre: a.titre,
            dossier: a.dossier,
            categorie: a.categorie,
            tags: a.tags.map((t) => t.tag.nom),
            x: coords[i].x,
            y: coords[i].y,
        }));

        return Response.json({ points });
    } catch (err) {
        console.error("Erreur /api/carte :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}