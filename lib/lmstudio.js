const LM_BASE = "http://localhost:1234/v1";
const CHAT_MODEL = "qwen2.5-3b-instruct";
const EMBED_MODEL = "text-embedding-nomic-embed-text-v1.5";

/**
 * Le modèle enrobe parfois sa réponse dans des fences markdown (```json ... ```)
 * malgré la consigne stricte de sortie JSON pure. On les retire avant de parser.
 */
function parseJsonContent(content) {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return JSON.parse(cleaned);
}

const SYSTEM_PROMPT = `Tu es un agent de veille technologique et d'actualité spécialisé dans 4 piliers fondamentaux :
1. Développement Web (Frontend/Backend, frameworks moderne, UI/UX, performances)
2. SEO & Search (Moteurs de recherche, GEO/SGE, critères Google, SEO technique)
3. Intelligence Artificielle (Modèles LLM, outils dev, automatisation, intégration web)
4. Esports & Valorant (Actualités VCT, patchs, meta, transferts, tactiques)

Tu reçois une source brute (article, changelog, vidéo, post social, note vocale) et tu dois produire une sortie JSON strictement valide, sans aucun texte explicatif avant ou après.

RÔLE : Évaluer, classer et proposer une reformulation à FORTE VALEUR AJOUTÉE. Ne fais JAMAIS une simple paraphrase ou un résumé neutre. Adapte l'angle de réécriture selon le domaine :
- Pour le Web/SEO/IA : Angle technique, impact sur les workflows, opportunités d'implémentation ou de positionnement.
- Pour Valorant : Angle analytique, impact sur la meta, stratégie de jeu ou actualité de la scène compétitive.

Structure JSON attendue :
{
  "legitimite": "Évaluation de la fiabilité en 1 phrase (source, auteur, biais, niveau de preuve)",
  "legitimite_niveau": "fiable | a_verifier | douteux",
  "nature": "article | video | post_reseau_social | patch_notes | note_terrain | autre",
  "categorie": "dev_web | seo | ia | valorant | autre",
  "interet": "Explication concrète de l'intérêt en 1-2 sentences",
  "interet_score": 1, // Note entière de 1 (anecdotique) à 5 (majeur, game changer)
  "valeur_ajoutee_potentielle": "En quoi ce contenu nourrit la posture d'expert ou la culture tech/gaming - 1-2 sentences",
  "tags": ["tag1", "tag2", "tag3"],
  "dossier_suggere": "Nom du dossier de rangement le plus pertinent parmi : __DOSSIERS__",
  "republication": {
    "accroche": "Phrase d'accroche percutante pour un post (LinkedIn ou X/Twitter) exprimant un point de vue tranché",
    "corps": "3-5 phrases d'analyse personnelle structurée. Donnes un avis, un cas d'usage ou un impact concret.",
    "format_suggere": "post_court | thread | article_long"
  }
}

RÈGLES STRICTES :
- Si l'information est insuffisante pour juger la légitimité, indique-le et définis "legitimite_niveau" sur "a_verifier".
- Le champ "republication" doit obligatoirement apporter un ANGLE ou un AVIS CRITIQUE.
- Le champ "interet_score" doit être un entier strict entre 1 et 5.`;

/**
 * Envoie une source brute au modèle de chat pour qualification + republication.
 * @param {string} rawContent - Le texte de la source
 * @param {string[]} dossiers - La liste des dossiers de rangement possibles
 * @returns {Promise<object>} L'objet JSON structuré retourné par le modèle
 */
export async function qualifySource(rawContent, dossiers) {
    const systemPrompt = SYSTEM_PROMPT.replace("__DOSSIERS__", dossiers.join(", "));

    const res = await fetch(`${LM_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: CHAT_MODEL,
            temperature: 0.3,
            response_format: { type: "text" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: rawContent },
            ],
        }),
    });

    if (!res.ok) {
        throw new Error(`Erreur LM Studio (chat) : ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return parseJsonContent(data.choices[0].message.content);
}

/**
 * Calcule l'embedding d'un texte à INDEXER (préfixe search_document).
 */
export async function embedDocument(text) {
    return embedRaw(`search_document: ${text}`);
}

/**
 * Calcule l'embedding d'une REQUÊTE de recherche (préfixe search_query).
 */
export async function embedQuery(text) {
    return embedRaw(`search_query: ${text}`);
}

async function embedRaw(prefixedText) {
    const res = await fetch(`${LM_BASE}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: prefixedText }),
    });

    if (!res.ok) {
        throw new Error(`Erreur LM Studio (embeddings) : ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
}

const NIVEAU_PROMPT = `Tu classes la fiabilité d'une source (Dev, SEO, IA ou Esports) à partir d'une évaluation.
Réponds uniquement avec l'un de ces trois mots, sans ponctuation :
fiable
a_verifier
douteux`;

export async function classerNiveauLegitimite(texteLegitimite) {
    const res = await fetch(`${LM_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: CHAT_MODEL,
            temperature: 0.1,
            max_tokens: 5,
            messages: [
                { role: "system", content: NIVEAU_PROMPT },
                { role: "user", content: texteLegitimite },
            ],
        }),
    });

    if (!res.ok) {
        throw new Error(`Erreur LM Studio (niveau) : ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const raw = data.choices[0].message.content.trim().toLowerCase();

    if (raw.includes("douteux")) return "douteux";
    if (raw.includes("fiable")) return "fiable";
    return "a_verifier";
}

const SCORE_INTERET_PROMPT = `Tu notes l'intérêt d'une actualité tech/gaming (1 à 5) à partir de son explication.
Réponds uniquement avec un chiffre entier de 1 à 5 :
1 = peu intéressant / bruit
3 = intéressant / utile
5 = majeur / game-changer`;

export async function classerScoreInteret(texteInteret) {
    const res = await fetch(`${LM_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: CHAT_MODEL,
            temperature: 0.1,
            max_tokens: 3,
            messages: [
                { role: "system", content: SCORE_INTERET_PROMPT },
                { role: "user", content: texteInteret },
            ],
        }),
    });

    if (!res.ok) {
        throw new Error(`Erreur LM Studio (score intérêt) : ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const raw = data.choices[0].message.content.trim();
    return parseInt(raw.match(/[1-5]/)?.[0] ?? "3", 10);
}

const PERTINENCE_PROMPT = `Tu es un analyste de retours d'audience sur des sujets Dev Web, SEO, IA et Valorant.
Analyse les réactions reçues à propos d'un contenu et produit un JSON valide :

{
  "humeur": "tres_positif | positif | mitige | negatif | tres_negatif",
  "synthese": "2-3 phrases résumant l'accueil global du sujet par la communauté/audience.",
  "recommandation": "Conseil d'action : approfondir le code, créer un tuto, tester le patch en game, ignorer, etc."
}`;

export async function analyserPertinence(titre, reactions) {
    const contenu = `Sujet : "${titre}"\n\nRéactions de l'audience :\n${reactions
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n")}`;

    const res = await fetch(`${LM_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: CHAT_MODEL,
            temperature: 0.3,
            response_format: { type: "text" },
            messages: [
                { role: "system", content: PERTINENCE_PROMPT },
                { role: "user", content: contenu },
            ],
        }),
    });

    if (!res.ok) {
        throw new Error(`Erreur LM Studio (pertinence) : ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    return parseJsonContent(data.choices[0].message.content);
}