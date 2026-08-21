import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
    try {
        const { nom } = await params;
        const dossier = decodeURIComponent(nom);

        const articles = await prisma.article.findMany({
            where: { dossier },
            include: {
                tags: { include: { tag: true } },
                source: true,
                reactions: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return Response.json({ dossier, articles });
    } catch (err) {
        console.error("Erreur /api/dossiers/[nom] :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}