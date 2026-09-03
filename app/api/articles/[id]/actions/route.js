import { prisma } from "@/lib/prisma";

// Lie un article à un projet/décision avec un impact décrit en texte libre
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const { projet, impact } = await req.json();

        const nomProjet = (projet ?? "").trim();
        const texteImpact = (impact ?? "").trim();

        if (!nomProjet || !texteImpact) {
            return Response.json(
                { error: "projet et impact sont requis" },
                { status: 400 }
            );
        }

        const projetRow = await prisma.projet.upsert({
            where: { nom: nomProjet },
            create: { nom: nomProjet },
            update: {},
        });

        await prisma.actionLiee.create({
            data: { articleId: id, projetId: projetRow.id, impact: texteImpact },
        });

        const article = await prisma.article.findUnique({
            where: { id },
            include: { actions: { include: { projet: true }, orderBy: { createdAt: "desc" } } },
        });

        return Response.json({ article });
    } catch (err) {
        console.error("Erreur POST actions :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}

// Retire une action liée à un article
export async function DELETE(req, { params }) {
    try {
        const { id } = await params;
        const { actionId } = await req.json();

        await prisma.actionLiee.delete({ where: { id: actionId } });

        const article = await prisma.article.findUnique({
            where: { id },
            include: { actions: { include: { projet: true }, orderBy: { createdAt: "desc" } } },
        });

        return Response.json({ article });
    } catch (err) {
        console.error("Erreur DELETE actions :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
