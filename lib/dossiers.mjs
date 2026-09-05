export const SEED_DOSSIERS = ["IA", "Automatisation", "Design", "Culture", "SEO", "Développement web"];

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
