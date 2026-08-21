import { prisma } from "@/lib/prisma";

// Retourne la liste des dossiers avec le nombre d'articles dans chacun
export async function GET() {
    try {
        const articles = await prisma.article.findMany({
            select: { dossier: true },
        });

        const counts = {};
        for (const a of articles) {
            counts[a.dossier] = (counts[a.dossier] ?? 0) + 1;
        }

        const dossiers = Object.entries(counts)
            .map(([nom, count]) => ({ nom, count }))
            .sort((a, b) => b.count - a.count);

        return Response.json({ dossiers });
    } catch (err) {
        console.error("Erreur /api/dossiers :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}