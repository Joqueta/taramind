import { prisma } from "@/lib/prisma";

// Ajouter un tag à un article (le crée si le tag n'existe pas encore)
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const { nom } = await req.json();

        if (!nom || !nom.trim()) {
            return Response.json({ error: "nom du tag requis" }, { status: 400 });
        }

        const tag = await prisma.tag.upsert({
            where: { nom: nom.trim() },
            create: { nom: nom.trim() },
            update: {},
        });

        await prisma.tagOnArticle.upsert({
            where: { articleId_tagId: { articleId: id, tagId: tag.id } },
            create: { articleId: id, tagId: tag.id },
            update: {},
        });

        const article = await prisma.article.findUnique({
            where: { id },
            include: { tags: { include: { tag: true } } },
        });

        return Response.json({ article });
    } catch (err) {
        console.error("Erreur POST tags :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// Retirer un tag d'un article
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const { tagId } = await req.json();

        await prisma.tagOnArticle.delete({
            where: { articleId_tagId: { articleId: id, tagId } },
        });

        const article = await prisma.article.findUnique({
            where: { id },
            include: { tags: { include: { tag: true } } },
        });

        return Response.json({ article });
    } catch (err) {
        console.error("Erreur DELETE tags :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}