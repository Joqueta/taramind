import { test } from "node:test";
import assert from "node:assert/strict";
import {
    normalizeDossierName,
    resolveDossierName,
    mergeDossiers,
    dossierDepuisCategorie,
    SEED_DOSSIERS,
} from "./dossiers.mjs";

test("normalizeDossierName folds case, accents and trailing plural s", () => {
    assert.equal(normalizeDossierName("Esports"), normalizeDossierName("esport"));
    assert.equal(normalizeDossierName("Développement web"), normalizeDossierName("developpement webs"));
});

test("resolveDossierName reuses the existing canonical spelling on a normalized match", () => {
    const existing = ["IA", "Esports"];
    assert.equal(resolveDossierName("Esport", existing), "Esports");
    assert.equal(resolveDossierName("esports", existing), "Esports");
});

test("resolveDossierName returns the trimmed proposal when nothing matches", () => {
    const existing = ["IA", "Esports"];
    assert.equal(resolveDossierName("  Culture Gaming  ", existing), "Culture Gaming");
});

test("mergeDossiers keeps DB dossiers first and appends missing seed entries", () => {
    const result = mergeDossiers(["Esports"], SEED_DOSSIERS);
    assert.equal(result[0], "Esports");
    for (const seedItem of SEED_DOSSIERS) {
        assert.ok(result.includes(seedItem));
    }
});

test("mergeDossiers does not duplicate a seed entry already present in DB", () => {
    const result = mergeDossiers(["ia"], SEED_DOSSIERS);
    const count = result.filter((d) => normalizeDossierName(d) === normalizeDossierName("IA")).length;
    assert.equal(count, 1);
});

test("dossierDepuisCategorie maps the four known categories deterministically", () => {
    assert.equal(dossierDepuisCategorie("dev_web"), "Développement web");
    assert.equal(dossierDepuisCategorie("seo"), "SEO");
    assert.equal(dossierDepuisCategorie("ia"), "IA");
    assert.equal(dossierDepuisCategorie("valorant"), "Esports");
});

test("dossierDepuisCategorie returns null for 'autre' or an unknown categorie", () => {
    assert.equal(dossierDepuisCategorie("autre"), null);
    assert.equal(dossierDepuisCategorie("n_importe_quoi"), null);
});
