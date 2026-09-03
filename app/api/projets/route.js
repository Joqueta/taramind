import { prisma } from "@/lib/prisma";

// Liste tous les projets existants (pour l'autocomplete du formulaire d'action)
export async function GET() {
    try {
        const projets = await prisma.projet.findMany({ orderBy: { nom: "asc" } });
        return Response.json({ projets });
    } catch (err) {
        console.error("Erreur GET projets :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
