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
                // Un item RSS sans lien n'a rien à extraire : on l'ignore
                // sans le compter comme une erreur d'ingestion.
                if (!item.link) {
                    ignores++;
                    continue;
                }

                try {
                    const result = await ingestSource({
                        url: item.link,
                        type: "article",
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