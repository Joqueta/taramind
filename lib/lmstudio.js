const LM_BASE = "http://localhost:1234/v1";
const CHAT_MODEL = "qwen2.5-7b-instruct-1m";
const EMBED_MODEL = "text-embedding-nomic-embed-text-v1.5";

const SYSTEM_PROMPT = `Tu es l'agent de veille technologique. Tu reçois une source brute
(article, vidéo, post réseau social, ou note vocale terrain) et tu dois produire une
sortie JSON strictement valide, sans aucun texte avant ou après.

CONTEXTE : cette source alimente une base de connaissances personnelle. Ton rôle n'est
pas de résumer platement, mais d'évaluer, classer, et proposer une reformulation à
VALEUR AJOUTÉE (angle personnel, mise en perspective, lien avec d'autres sujets déjà
connus), jamais une paraphrase neutre.

Pour CHAQUE source, retourne un objet JSON avec exactement ces clés :

{
  "legitimite": "évalue la fiabilité de la source en 1 phrase (auteur, média, biais éventuel)",
  "nature": "article | video | post_reseau_social | note_terrain | autre",
  "categorie": "metier | pro | perso | culture",
  "interet": "pourquoi c'est intéressant, en 1-2 phrases concrètes",
  "valeur_ajoutee_potentielle": "en quoi ça augmente le veilleur (personal branding ou posture de marque) - 1-2 phrases",
  "tags": ["tag1", "tag2", "tag3"],
  "dossier_suggere": "nom du dossier de rangement le plus pertinent parmi : __DOSSIERS__",
  "republication": {
    "accroche": "une phrase d'accroche pour un post LinkedIn/réseau, avec un vrai point de vue",
    "corps": "3-5 phrases de commentaire personnel et structuré, PAS un résumé, un vrai avis argumenté",
    "format_suggere": "post_court | thread | article_long"
  }
}

RÈGLES :
- Une source peut porter PLUSIEURS tags/thématiques à la fois.
- Si l'information est insuffisante pour juger la légitimité, dis-le explicitement.
- Le champ "republication" doit toujours proposer un ANGLE, jamais un résumé neutre.
- Réponds uniquement en JSON valide, aucun markdown, aucune explication hors du JSON.`;

/**
 * Envoie une source brute au modèle de chat pour qualification + republication.
 * @param {string} rawContent - Le texte de la source (article, transcription, etc.)
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
            temperature: 0.4,
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
    const raw = data.choices[0].message.content;

    // Sécurité : nettoie d'éventuels ```json accidentels
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
}

/**
 * Calcule l'embedding d'un texte à INDEXER (préfixe search_document).
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embedDocument(text) {
    return embedRaw(`search_document: ${text}`);
}

/**
 * Calcule l'embedding d'une REQUÊTE de recherche (préfixe search_query).
 * @param {string} text
 * @returns {Promise<number[]>}
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

const PERTINENCE_PROMPT = `Tu es un agent d'analyse de pertinence. Tu reçois le titre d'un
article et une liste de réactions/commentaires reçus à son sujet (sur un post, dans une
conversation, etc.). Ton rôle est d'évaluer l'accueil qui a été fait à ce contenu.

Retourne un JSON strictement valide avec ces clés exactes :

{
  "humeur": "tres_positif | positif | mitige | negatif | tres_negatif",
  "synthese": "2-3 phrases expliquant pourquoi l'article a été bien ou mal reçu, en te basant
               concrètement sur les réactions fournies",
  "recommandation": "un conseil concret pour la suite : creuser ce sujet, republier avec un
                      angle différent, laisser de côté, etc."
}

Réponds uniquement en JSON valide, aucun texte avant ou après.`;

/**
 * Analyse l'humeur/pertinence d'un article à partir de réactions collectées.
 * @param {string} titre - Titre de l'article
 * @param {string[]} reactions - Liste des réactions/commentaires bruts
 * @returns {Promise<{humeur: string, synthese: string, recommandation: string}>}
 */
export async function analyserPertinence(titre, reactions) {
    const contenu = `Article : "${titre}"\n\nRéactions reçues :\n${reactions
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n")}`;

    const res = await fetch(`${LM_BASE}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: CHAT_MODEL,
            temperature: 0.3,
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
    const raw = data.choices[0].message.content;
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
}