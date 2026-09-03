import { classerNiveauLegitimite } from "@/lib/lmstudio";
import { prisma } from "@/lib/prisma";

// Évalue le niveau de légitimité des sources plus anciennes qui n'en ont pas encore
export async function POST() {
    try {
        const sources = await prisma.source.findMany({
            where: { legitimiteNiveau: null },
        });

        let evalues = 0;
        let erreurs = 0;

        for (const source of sources) {
            try {
                const niveau = await classerNiveauLegitimite(source.legitimite);
                await prisma.source.update({
                    where: { id: source.id },
                    data: { legitimiteNiveau: niveau },
                });
                evalues++;
            } catch (err) {
                erreurs++;
                console.error(`Erreur évaluation source ${source.id} :`, err.message);
            }
        }

        return Response.json({ evalues, erreurs, total: sources.length });
    } catch (err) {
        console.error("Erreur POST legitimite/backfill :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
