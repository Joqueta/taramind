import { prisma } from "@/lib/prisma";

// Supprime un article ainsi que ses tags, réactions et actions liées
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;

        await prisma.$transaction([
            prisma.tagOnArticle.deleteMany({ where: { articleId: id } }),
            prisma.reaction.deleteMany({ where: { articleId: id } }),
            prisma.actionLiee.deleteMany({ where: { articleId: id } }),
            prisma.article.delete({ where: { id } }),
        ]);

        return Response.json({ ok: true });
    } catch (err) {
        console.error("Erreur DELETE article :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
