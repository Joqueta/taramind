import { searchArticles } from "@/lib/rag";

export async function POST(req) {
    try {
        const { query, topK } = await req.json();

        if (!query || !query.trim()) {
            return Response.json({ error: "query est requis" }, { status: 400 });
        }

        const results = await searchArticles(query, topK ?? 5);

        return Response.json({
            query,
            results: results.map(({ article, score }) => ({
                id: article.id,
                titre: article.titre,
                dossier: article.dossier,
                categorie: article.categorie,
                interet: article.interet,
                tags: article.tags.map((t) => t.tag.nom),
                sourceUrl: article.source?.url ?? null,
                score: Math.round(score * 1000) / 1000,
            })),
        });
    } catch (err) {
        console.error("Erreur /api/search :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}