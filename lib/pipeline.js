import { qualifySource, embedDocument } from "./lmstudio";
import { prisma } from "./prisma";
import { extractPageContent } from "./extract.mjs";
import { SEED_DOSSIERS, mergeDossiers, resolveDossierName } from "./dossiers.mjs";

/**
 * Récupère les dossiers déjà utilisés en base, fusionnés avec la liste de
 * départ. Sert de vivier de choix (et de suggestions) pour la qualification.
 */
export async function getDossiersExistants() {
    const rows = await prisma.article.findMany({
        distinct: ["dossier"],
        select: { dossier: true },
    });
    return mergeDossiers(rows.map((r) => r.dossier), SEED_DOSSIERS);
}

/**
 * Pipeline complet : qualifier → ranger. Utilisé par la capture manuelle ET la veille auto.
 * @param {{url?: string, type?: string, rawContent?: string}} input
 * @returns {Promise<object>} { source, article, dossierSuggere, republication }
 */
export async function ingestSource({ url, type, rawContent }) {
    if (!rawContent && !url) {
        throw new Error("rawContent ou url est requis");
    }

    // Évite de traiter deux fois la même URL
    if (url) {
        const existing = await prisma.source.findFirst({ where: { url } });
        if (existing) {
            return { skipped: true, reason: "URL déjà en base", url };
        }
    }

    const content = rawContent || (await extractPageContent(url));

    const dossiersExistants = await getDossiersExistants();
    const result = await qualifySource(content, dossiersExistants);
    result.dossier_suggere = resolveDossierName(result.dossier_suggere, dossiersExistants);

    let source;
    try {
        source = await prisma.source.create({
            data: {
                url: url ?? null,
                type: type ?? result.nature,
                legitimite: result.legitimite,
                legitimiteNiveau: result.legitimite_niveau ?? null,
            },
        });
    } catch (err) {
        // Une autre exécution concurrente a inséré la même URL entre-temps
        if (err.code === "P2002") {
            return { skipped: true, reason: "URL déjà en base (concurrence)", url };
        }
        throw err;
    }

    const vec = await embedDocument(content + " " + result.interet);

    const interetScore = Number.parseInt(result.interet_score, 10);

    const article = await prisma.article.create({
        data: {
            sourceId: source.id,
            titre: content.slice(0, 80),
            categorie: result.categorie,
            dossier: result.dossier_suggere,
            interet: result.interet,
            interetScore: interetScore >= 1 && interetScore <= 5 ? interetScore : null,
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
