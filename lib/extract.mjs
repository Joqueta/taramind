import * as cheerio from "cheerio";

// Budget de contexte : ~2500 mots FR reste dans la fenêtre de contexte du
// modèle local une fois le system prompt et le JSON de sortie ajoutés.
export const MAX_WORDS = 2500;

export function htmlToText(html) {
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, noscript").remove();

    const title = $("title").first().text().replace(/\s+/g, " ").trim();
    const container = $("article").length
        ? $("article")
        : $("main").length
          ? $("main")
          : $("body");

    const bodyText = container.text().replace(/\s+/g, " ").trim();
    const fullText = title ? `${title}\n\n${bodyText}` : bodyText;

    const words = fullText.trim().split(/\s+/);
    return words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(" ") : fullText;
}

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function extractPageContent(url, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    // Le timer reste armé jusqu'à la fin de la lecture du corps de la réponse
    // (pas seulement jusqu'à la résolution des en-têtes) : une réponse qui
    // "goutte" lentement doit aussi être interrompue par le timeout.
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        let res;
        try {
            res = await fetch(url, {
                headers: { "User-Agent": USER_AGENT },
                signal: controller.signal,
            });
        } catch (err) {
            if (err.name === "AbortError") {
                throw new Error(`Timeout lors de la récupération de ${url}`);
            }
            throw new Error(`Impossible de joindre ${url} : ${err.message}`);
        }

        if (!res.ok) {
            throw new Error(`Erreur ${res.status} en récupérant ${url}`);
        }

        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) {
            throw new Error(`Le contenu de ${url} n'est pas une page HTML (${contentType || "type inconnu"})`);
        }

        let text;
        try {
            const html = await res.text();
            text = htmlToText(html);
        } catch (err) {
            if (err.name === "AbortError") {
                throw new Error(`Timeout lors de la récupération de ${url}`);
            }
            throw new Error(`Erreur lors de la lecture de ${url} : ${err.message}`);
        }

        if (!text) {
            throw new Error(`Aucun contenu exploitable trouvé sur ${url}`);
        }

        return text;
    } finally {
        clearTimeout(timer);
    }
}
