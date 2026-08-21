import Parser from "rss-parser";
import { FEEDS } from "@/config/feeds";
import { ingestSource } from "./pipeline";

const parser = new Parser();

/**
 * Scanne tous les flux RSS configurés, et envoie chaque nouvel article
 * dans le pipeline qualifier → ranger. Les doublons (même URL déjà en base)
 * sont automatiquement ignorés par ingestSource.
 * @returns {Promise<{traites: number, ignores: number, erreurs: number, details: object[]}>}
 */
export async function runVeille() {
    let traites = 0;
    let ignores = 0;
    let erreurs = 0;
    const details = [];

    for (const feed of FEEDS) {
        try {
            const parsed = await parser.parseURL(feed.url);

            // On limite aux 5 articles les plus récents par flux, pour ne pas
            // surcharger le modèle local lors du premier scan
            const items = parsed.items.slice(0, 5);

            for (const item of items) {
                const rawContent = [item.title, item.contentSnippet ?? item.content]
                    .filter(Boolean)
                    .join(" — ");

                try {
                    const result = await ingestSource({
                        url: item.link,
                        type: "article",
                        rawContent,
                    });

                    if (result.skipped) {
                        ignores++;
                    } else {
                        traites++;
                        details.push({ titre: item.title, source: feed.label });
                    }
                } catch (err) {
                    erreurs++;
                    console.error(`Erreur ingestion "${item.title}" :`, err.message);
                }
            }
        } catch (err) {
            erreurs++;
            console.error(`Erreur lecture flux ${feed.label} :`, err.message);
        }
    }

    return { traites, ignores, erreurs, details };
}