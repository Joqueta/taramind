export const SEED_DOSSIERS = ["IA", "Automatisation", "Design", "Culture", "SEO", "Développement web", "Esports"];

// Pour les 4 catégories connues (champ "categorie", vocabulaire fermé côté
// prompt), le dossier est déterminé directement par le code plutôt que par
// le modèle : un LLM local de petite taille suit mal la consigne "domaine
// thématique, pas nature du contenu" en texte libre (ex: il propose "Patch
// Notes" au lieu de "Esports" pour un article de patch notes Valorant). La
// résolution en texte libre (normalizeDossierName / resolveDossierName)
// reste utilisée uniquement pour categorie === "autre".
const CATEGORIE_VERS_DOSSIER = {
    dev_web: "Développement web",
    seo: "SEO",
    ia: "IA",
    valorant: "Esports",
};

export function dossierDepuisCategorie(categorie) {
    return CATEGORIE_VERS_DOSSIER[categorie] ?? null;
}

export function normalizeDossierName(name) {
    return name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/s$/, "");
}

export function resolveDossierName(proposed, existing) {
    const trimmedProposed = proposed.trim();
    const normalizedProposed = normalizeDossierName(trimmedProposed);
    const match = existing.find((d) => normalizeDossierName(d) === normalizedProposed);
    return match ?? trimmedProposed;
}

export function mergeDossiers(fromDb, seed) {
    const result = [...fromDb];
    for (const s of seed) {
        const normalizedSeed = normalizeDossierName(s);
        const alreadyPresent = result.some((d) => normalizeDossierName(d) === normalizedSeed);
        if (!alreadyPresent) {
            result.push(s);
        }
    }
    return result;
}
