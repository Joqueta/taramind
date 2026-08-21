import { qualifySource, embedDocument } from "./lmstudio";
import { prisma } from "./prisma";

const DOSSIERS = ["IA", "Automatisation", "Design", "Culture", "Business"];

/**
 * Pipeline complet : qualifier → ranger. Utilisé par la capture manuelle ET la veille auto.
 * @param {{url?: string, type?: string, rawContent: string}} input
 * @returns {Promise<object>} { source, article, dossierSuggere, republication }
 */
export async function ingestSource({ url, type, rawContent }) {
    if (!rawContent) {
        throw new Error("rawContent est requis");
    }

    // Évite de traiter deux fois la même URL
    if (url) {
        const existing = await prisma.source.findFirst({ where: { url } });
        if (existing) {
            return { skipped: true, reason: "URL déjà en base", url };
        }
    }

    const result = await qualifySource(rawContent, DOSSIERS);

    const source = await prisma.source.create({
        data: {
            url: url ?? null,
            type: type ?? result.nature,
            legitimite: result.legitimite,
        },
    });

    const vec = await embedDocument(rawContent + " " + result.interet);

    const article = await prisma.article.create({
        data: {
            sourceId: source.id,
            titre: rawContent.slice(0, 80),
            categorie: result.categorie,
            dossier: result.dossier_suggere,
            interet: result.interet,
            valeurAjoutee: result.valeur_ajoutee_potentielle,
            republicationJson: JSON.stringify(result.republication),
            embedding: JSON.stringify(vec),
            tags: {
                create: result.tags.map((nom) => ({
                    tag: {
                        connectOrCreate: { where: { nom }, create: { nom } },
                    },
                })),
            },
        },
        include: { tags: { include: { tag: true } } },
    });

    return {
        skipped: false,
        source,
        article,
        dossierSuggere: result.dossier_suggere,
        republication: result.republication,
    };
}