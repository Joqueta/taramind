import { prisma } from "@/lib/prisma";

// Toutes les actions liées, triées du plus récent au plus ancien
export async function GET() {
    try {
        const actions = await prisma.actionLiee.findMany({
            include: {
                projet: true,
                article: { select: { id: true, titre: true, dossier: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return Response.json({ actions });
    } catch (err) {
        console.error("Erreur GET journal :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
