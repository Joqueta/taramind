import { prisma } from "@/lib/prisma";

// Répartition des sources par type et par niveau de légitimité
export async function GET() {
    try {
        const sources = await prisma.source.findMany({
            select: { type: true, legitimiteNiveau: true },
        });

        const parType = {};
        const parNiveau = {};

        for (const s of sources) {
            parType[s.type] = (parType[s.type] ?? 0) + 1;
            const niveau = s.legitimiteNiveau ?? "non_evalue";
            parNiveau[niveau] = (parNiveau[niveau] ?? 0) + 1;
        }

        return Response.json({
            total: sources.length,
            parType,
            parNiveau,
        });
    } catch (err) {
        console.error("Erreur GET stats :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
