import { prisma } from "./prisma";
import { embedQuery } from "./lmstudio";

/**
 * Similarité cosinus entre deux vecteurs.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} score entre -1 et 1 (plus proche de 1 = plus similaire)
 */
function cosineSim(a, b) {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    return dot / (normA * normB);
}

/**
 * Recherche sémantique dans les articles stockés.
 * @param {string} query - La question/recherche de l'utilisateur
 * @param {number} topK - Nombre de résultats à retourner
 * @returns {Promise<Array<{article: object, score: number}>>}
 */
export async function searchArticles(query, topK = 5) {
    const queryVec = await embedQuery(query);

    const articles = await prisma.article.findMany({
        include: {
            tags: { include: { tag: true } },
            source: true,
        },
    });

    const scored = articles
        .filter((a) => a.embedding)
        .map((a) => ({
            article: a,
            score: cosineSim(queryVec, JSON.parse(a.embedding)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

    return scored;
}