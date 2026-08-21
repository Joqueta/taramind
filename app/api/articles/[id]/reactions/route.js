import { prisma } from "@/lib/prisma";
import { analyserPertinence } from "@/lib/lmstudio";

// Ajouter une réaction à un article
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const { contenu } = await req.json();

        if (!contenu || !contenu.trim()) {
            return Response.json({ error: "contenu requis" }, { status: 400 });
        }

        await prisma.reaction.create({
            data: { articleId: id, contenu: contenu.trim() },
        });

        const article = await prisma.article.findUnique({
            where: { id },
            include: { reactions: true },
        });

        return Response.json({ article });
    } catch (err) {
        console.error("Erreur POST reactions :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// Lancer l'analyse de pertinence sur toutes les réactions collectées
export async function PUT(req, { params }) {
    try {
        const { id } = await params;

        const article = await prisma.article.findUnique({
            where: { id },
            include: { reactions: true },
        });

        if (!article) {
            return Response.json({ error: "Article introuvable" }, { status: 404 });
        }
        if (article.reactions.length === 0) {
            return Response.json({ error: "Aucune réaction à analyser" }, { status: 400 });
        }

        const result = await analyserPertinence(
            article.titre,
            article.reactions.map((r) => r.contenu)
        );

        const updated = await prisma.article.update({
            where: { id },
            data: { humeur: result.humeur, humeurSynthese: result.synthese },
            include: { reactions: true },
        });

        return Response.json({ article: updated, recommandation: result.recommandation });
    } catch (err) {
        console.error("Erreur PUT reactions :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}