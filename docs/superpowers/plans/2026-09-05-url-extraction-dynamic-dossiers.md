# Extraction automatique par URL + dossiers dynamiques Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturer une source par URL seule (le contenu de la page est récupéré et extrait automatiquement) et ranger les articles dans des dossiers dynamiques (réutilisés depuis la base ou proposés par le modèle) au lieu d'une liste figée.

**Architecture:** Deux nouveaux modules purs et testables (`lib/extract.mjs` pour le HTML→texte, `lib/dossiers.mjs` pour la normalisation des noms de dossiers), branchés dans `lib/pipeline.js::ingestSource` qui reste le point d'entrée unique utilisé par la capture manuelle (`app/api/ingest`) et la veille RSS (`lib/veille.js`).

**Tech Stack:** Next.js 16 (App Router), Prisma + SQLite, cheerio (nouvelle dépendance) pour le parsing HTML, LM Studio local (Qwen2.5-3B) via `lib/lmstudio.js`.

## Global Constraints

- Ce projet n'a aucun framework de test existant (pas de jest/vitest, pas de script `test`). On introduit le test runner natif de Node (`node --test`, disponible nativement dès Node 18+, confirmé présent en Node v24 ici) — zéro nouvelle dépendance de test.
- Les fichiers `lib/*.js` existants utilisent la syntaxe `import`/`export` mais tournent uniquement à travers le bundler de Next (le `package.json` n'a pas `"type": "module"`, et `scripts/scheduler.js` utilise `require()` en CommonJS — on ne touche pas à ce réglage global). Pour rendre le nouveau code testable directement avec `node --test`, **les deux nouveaux modules purs sont créés en `.mjs`** (`lib/extract.mjs`, `lib/dossiers.mjs`) : Next/Turbopack les bundle sans problème (extension ESM standard), et Node peut les exécuter nativement pour les tests.
- Le modèle local (LM Studio) est thermiquement coûteux (cf. diagnostic précédent). La vérification manuelle finale (Task 8) se limite à **une seule capture** via URL, pas un run complet de `runVeille` (qui ferait ~15 appels LLM).
- Troncature du texte extrait : 4000 mots (marge sous le `ctx-size` de 8192 tokens du modèle local).

---

### Task 1: `lib/extract.mjs` — extraction de texte depuis du HTML (fonction pure)

**Files:**
- Create: `lib/extract.mjs`
- Test: `lib/extract.test.mjs`
- Modify: `package.json` (ajout dépendance `cheerio` + script `test`)

**Interfaces:**
- Produces: `htmlToText(html: string): string` — texte nettoyé (titre + corps), tronqué à 4000 mots. Utilisé par `extractPageContent` (Task 2).
- Produces: `MAX_WORDS` (constante, 4000) — exportée pour que le test de troncature n'ait pas besoin de deviner la valeur.

- [ ] **Step 1: Installer cheerio et ajouter le script de test**

```bash
npm install cheerio
```

Puis dans `package.json`, ajoute dans `"scripts"` :
```json
"test": "node --test lib/"
```

- [ ] **Step 2: Écrire les tests (ils doivent échouer, le fichier n'existe pas encore)**

Crée `lib/extract.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText, MAX_WORDS } from "./extract.mjs";

test("htmlToText prefers <article> content and strips noise", () => {
    const html = `
        <html><head><title>Mon titre</title></head>
        <body>
            <nav>Menu</nav>
            <header>Header</header>
            <article><p>Contenu principal.</p></article>
            <footer>Footer</footer>
            <script>console.log("noise")</script>
        </body></html>
    `;
    const result = htmlToText(html);
    assert.ok(result.includes("Mon titre"));
    assert.ok(result.includes("Contenu principal."));
    assert.ok(!result.includes("Menu"));
    assert.ok(!result.includes("Footer"));
    assert.ok(!result.includes("noise"));
});

test("htmlToText falls back to <main> when there is no <article>", () => {
    const html = `<html><body><nav>Menu</nav><main><p>Texte principal.</p></main></body></html>`;
    const result = htmlToText(html);
    assert.ok(result.includes("Texte principal."));
    assert.ok(!result.includes("Menu"));
});

test("htmlToText falls back to <body> when there is neither <article> nor <main>", () => {
    const html = `<html><body><p>Juste du texte.</p></body></html>`;
    const result = htmlToText(html);
    assert.ok(result.includes("Juste du texte."));
});

test("htmlToText truncates to MAX_WORDS words", () => {
    const words = Array.from({ length: MAX_WORDS + 1000 }, (_, i) => `mot${i}`).join(" ");
    const html = `<html><body><article><p>${words}</p></article></body></html>`;
    const result = htmlToText(html);
    assert.equal(result.trim().split(" ").length, MAX_WORDS);
});
```

- [ ] **Step 3: Lancer les tests, vérifier qu'ils échouent**

Run: `node --test lib/extract.test.mjs`
Expected: FAIL — `Cannot find module './extract.mjs'`

- [ ] **Step 4: Implémenter `htmlToText`**

Crée `lib/extract.mjs` :

```js
import * as cheerio from "cheerio";

export const MAX_WORDS = 4000;

export function htmlToText(html) {
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer, aside, noscript").remove();

    const title = $("title").first().text().trim();
    const container = $("article").length
        ? $("article")
        : $("main").length
          ? $("main")
          : $("body");

    const bodyText = container.text().replace(/\s+/g, " ").trim();
    const fullText = title ? `${title}\n\n${bodyText}` : bodyText;

    const words = fullText.split(" ");
    return words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(" ") : fullText;
}
```

- [ ] **Step 5: Lancer les tests, vérifier qu'ils passent**

Run: `node --test lib/extract.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/extract.mjs lib/extract.test.mjs package.json package-lock.json
git commit -m "feat: add HTML-to-text extraction module"
```

---

### Task 2: `lib/extract.mjs` — `extractPageContent` (fetch + gestion d'erreurs)

**Files:**
- Modify: `lib/extract.mjs`
- Modify: `lib/extract.test.mjs`

**Interfaces:**
- Consumes: `htmlToText(html)` (Task 1)
- Produces: `extractPageContent(url: string, timeoutMs?: number): Promise<string>` — utilisé par `lib/pipeline.js` (Task 5). Rejette avec une `Error` au message explicite en cas d'échec (réseau, timeout, statut non-2xx, content-type non-HTML, page vide).

- [ ] **Step 1: Écrire les tests (ils doivent échouer)**

Ajoute à `lib/extract.test.mjs` (après les tests existants) :

```js
import { extractPageContent } from "./extract.mjs";

test("extractPageContent returns extracted text on success", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/html; charset=utf-8" },
        text: async () => "<html><body><article><p>Bonjour le monde.</p></article></body></html>",
    });

    try {
        const text = await extractPageContent("https://example.com/article");
        assert.ok(text.includes("Bonjour le monde."));
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractPageContent throws a clear error on non-ok status", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: false,
        status: 404,
        headers: { get: () => "text/html" },
        text: async () => "",
    });

    try {
        await assert.rejects(() => extractPageContent("https://example.com/missing"), /Erreur 404/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractPageContent throws a clear error on non-HTML content-type", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "application/pdf" },
        text: async () => "",
    });

    try {
        await assert.rejects(
            () => extractPageContent("https://example.com/file.pdf"),
            /n'est pas une page HTML/,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractPageContent wraps an aborted fetch as a timeout error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
    };

    try {
        await assert.rejects(() => extractPageContent("https://example.com/slow"), /Timeout/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractPageContent throws when extracted text is empty", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => "<html><body></body></html>",
    });

    try {
        await assert.rejects(() => extractPageContent("https://example.com/empty"), /Aucun contenu/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `node --test lib/extract.test.mjs`
Expected: FAIL — `extractPageContent is not a function` (ou `undefined`)

- [ ] **Step 3: Implémenter `extractPageContent`**

Ajoute à `lib/extract.mjs` :

```js
const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function extractPageContent(url, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        throw new Error(`Erreur ${res.status} en récupérant ${url}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
        throw new Error(`Le contenu de ${url} n'est pas une page HTML (${contentType || "type inconnu"})`);
    }

    const html = await res.text();
    const text = htmlToText(html);

    if (!text) {
        throw new Error(`Aucun contenu exploitable trouvé sur ${url}`);
    }

    return text;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `node --test lib/extract.test.mjs`
Expected: PASS (9 tests au total)

- [ ] **Step 5: Commit**

```bash
git add lib/extract.mjs lib/extract.test.mjs
git commit -m "feat: fetch and extract page content from a URL"
```

---

### Task 3: `lib/dossiers.mjs` — normalisation et fusion des noms de dossiers

**Files:**
- Create: `lib/dossiers.mjs`
- Test: `lib/dossiers.test.mjs`

**Interfaces:**
- Produces: `SEED_DOSSIERS: string[]` — liste de départ (les 6 dossiers actuels).
- Produces: `normalizeDossierName(name: string): string` — clé de comparaison (minuscules, sans accents, sans "s" final).
- Produces: `resolveDossierName(proposed: string, existing: string[]): string` — utilisé par `lib/pipeline.js` (Task 5) pour éviter les doublons proches.
- Produces: `mergeDossiers(fromDb: string[], seed: string[]): string[]` — utilisé par `getDossiersExistants` dans `lib/pipeline.js` (Task 5).

- [ ] **Step 1: Écrire les tests (ils doivent échouer)**

Crée `lib/dossiers.test.mjs` :

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDossierName, resolveDossierName, mergeDossiers, SEED_DOSSIERS } from "./dossiers.mjs";

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
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `node --test lib/dossiers.test.mjs`
Expected: FAIL — `Cannot find module './dossiers.mjs'`

- [ ] **Step 3: Implémenter le module**

Crée `lib/dossiers.mjs` :

```js
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
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `node --test lib/dossiers.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/dossiers.mjs lib/dossiers.test.mjs
git commit -m "feat: add dossier name normalization and merging"
```

---

### Task 4: `lib/lmstudio.js` — reformuler le prompt pour des dossiers dynamiques

**Files:**
- Modify: `lib/lmstudio.js:33` (ligne `"dossier_suggere": ...` dans `SYSTEM_PROMPT`)

**Interfaces:**
- Aucune interface nouvelle — `qualifySource(rawContent, dossiers)` garde exactement la même signature (`dossiers: string[]`), seul le texte du prompt change. `dossiers` sera désormais la liste dynamique produite par `getDossiersExistants()` (Task 5) au lieu de la constante figée.

- [ ] **Step 1: Modifier le prompt**

Dans `lib/lmstudio.js`, remplace la ligne :

```js
  "dossier_suggere": "Nom du dossier de rangement le plus pertinent parmi : __DOSSIERS__",
```

par :

```js
  "dossier_suggere": "Nom du dossier de rangement. Dossiers déjà existants : __DOSSIERS__. Réutilise un dossier existant si le sujet correspond, même partiellement. Si aucun ne convient, propose un nouveau nom court (1 à 3 mots), cohérent avec le style des dossiers existants.",
```

- [ ] **Step 2: Vérification**

Pas de test automatisé possible ici (c'est du texte de prompt envoyé au LLM) — ce sera vérifié manuellement à la Task 8. Vérifie juste que le fichier reste un JSON valide dans le template (la virgule finale, les guillemets).

- [ ] **Step 3: Commit**

```bash
git add lib/lmstudio.js
git commit -m "feat: reword dossier prompt to support dynamic reuse or creation"
```

---

### Task 5: `lib/pipeline.js` — brancher extraction et dossiers dynamiques dans `ingestSource`

**Files:**
- Modify: `lib/pipeline.js`

**Interfaces:**
- Consumes: `extractPageContent(url)` (Task 2), `SEED_DOSSIERS`, `mergeDossiers`, `resolveDossierName` (Task 3).
- Produces: `getDossiersExistants(): Promise<string[]>` (nouvelle export, pas d'autre fichier ne la consomme dans ce plan mais elle est exportée pour être testable manuellement/appelable ailleurs plus tard).
- `ingestSource({ url, type, rawContent })` change de contrat : `rawContent` devient optionnel si `url` est fourni.

Pas de test automatisé pour cette tâche : `ingestSource` orchestre Prisma + LM Studio (I/O réel), et le projet n'a pas de convention de mocking pour Prisma. Vérification manuelle prévue à la Task 8.

- [ ] **Step 1: Remplacer le contenu de `lib/pipeline.js`**

```js
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
```

Notes sur les changements par rapport à l'existant :
- `titre: content.slice(0, 80)` (au lieu de `rawContent.slice(0, 80)`) — `rawContent` peut désormais être vide quand le contenu vient de l'extraction, `content` est toujours la valeur effective.
- La constante `DOSSIERS` figée disparaît, remplacée par `getDossiersExistants()`.

- [ ] **Step 2: Vérifier que les tests existants (Tasks 1-3) passent toujours**

Run: `node --test lib/`
Expected: PASS (tous les tests des Tasks 1-3, `pipeline.js` n'a pas de test propre)

- [ ] **Step 3: Commit**

```bash
git add lib/pipeline.js
git commit -m "feat: wire URL content extraction and dynamic dossiers into ingestSource"
```

---

### Task 6: `lib/veille.js` — simplifier pour s'appuyer sur l'extraction intégrée

**Files:**
- Modify: `lib/veille.js`

**Interfaces:**
- Consumes: `ingestSource({ url, type })` (contrat mis à jour en Task 5 — `rawContent` optionnel).

- [ ] **Step 1: Simplifier la boucle interne**

Dans `lib/veille.js`, remplace :

```js
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
```

par :

```js
            for (const item of items) {
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
```

Un item dont l'extraction de page échoue (timeout, page inaccessible...) est compté dans `erreurs`, comme n'importe quelle autre erreur d'ingestion aujourd'hui — le scan continue sur les items suivants.

- [ ] **Step 2: Vérifier que les tests existants passent toujours**

Run: `node --test lib/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/veille.js
git commit -m "refactor: let ingestSource fetch full article content for RSS items"
```

---

### Task 7: `app/capture/page.js` — champ Contenu conditionnel

**Files:**
- Modify: `app/capture/page.js`

**Interfaces:**
- Consumes: `/api/ingest` (contrat mis à jour en Task 5 — `rawContent` optionnel si `url` fourni).

- [ ] **Step 1: Adapter `handleSubmit` pour ne pas envoyer un contenu obsolète**

Remplace :

```js
            body: JSON.stringify({ url: url || undefined, type, rawContent }),
```

par :

```js
            body: JSON.stringify({
                url: url || undefined,
                type,
                rawContent: url.trim() ? undefined : rawContent,
            }),
```

- [ ] **Step 2: Rendre le bloc "Contenu" conditionnel**

Remplace :

```js
                <div className="bg-[var(--surface)] p-5">
                    <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                        Contenu
                    </label>
                    <textarea
                        value={rawContent}
                        onChange={(e) => setRawContent(e.target.value)}
                        required
                        rows={8}
                        placeholder="Colle le texte de l'article, la transcription, ou décris ton idée…"
                        className="focus-mark w-full resize-none bg-[var(--surface-dim)] px-4 py-3 text-sm text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                    />
                </div>
```

par :

```js
                {!url.trim() && (
                    <div className="bg-[var(--surface)] p-5">
                        <label className="mb-2 block text-xs uppercase tracking-wide text-[var(--azul-dim)]">
                            Contenu
                        </label>
                        <textarea
                            value={rawContent}
                            onChange={(e) => setRawContent(e.target.value)}
                            required
                            rows={8}
                            placeholder="Colle le texte de l'article, la transcription, ou décris ton idée…"
                            className="focus-mark w-full resize-none bg-[var(--surface-dim)] px-4 py-3 text-sm text-[var(--azul)] placeholder:text-[var(--azul-dim)]"
                        />
                    </div>
                )}
```

- [ ] **Step 3: Mettre à jour la condition du bouton**

Remplace :

```js
                    disabled={loading || !rawContent.trim()}
```

par :

```js
                    disabled={loading || (!url.trim() && !rawContent.trim())}
```

- [ ] **Step 4: Vérifier que les tests existants passent toujours**

Run: `node --test lib/`
Expected: PASS (cette task ne touche pas `lib/`, juste confirmation qu'on n'a rien cassé)

- [ ] **Step 5: Commit**

```bash
git add app/capture/page.js
git commit -m "feat: hide manual content field when a URL is provided"
```

---

### Task 8: Vérification manuelle de bout en bout

**Files:** aucun changement de code — validation uniquement.

- [ ] **Step 1: Lancer la suite de tests complète**

Run: `node --test lib/`
Expected: PASS (tous les tests des Tasks 1, 2, 3)

- [ ] **Step 2: Démarrer le serveur de dev**

```bash
npm run dev
```

- [ ] **Step 3: Vérifier le comportement du formulaire dans le navigateur**

Ouvre `http://localhost:3000/capture` :
- Tape une URL dans le champ URL → le champ "Contenu" doit disparaître.
- Vide le champ URL → le champ "Contenu" doit réapparaître (et garder le texte déjà tapé, s'il y en avait).

- [ ] **Step 4: Capturer une source réelle par URL seule**

Avec le serveur de dev et LM Studio lancés, colle une URL d'article (par exemple une autre page de patch notes ou un article de blog) dans le champ URL, laisse "Contenu" vide (il doit être caché), clique "Capturer".

Résultat attendu : message de succès avec le dossier choisi, pas d'erreur. Une seule capture suffit pour cette vérification — pas besoin de lancer un scan RSS complet (coûteux en calcul LLM local).

- [ ] **Step 5: Vérifier en base que le dossier est cohérent**

```bash
sqlite3 dev.db "SELECT titre, dossier, categorie FROM Article ORDER BY createdAt DESC LIMIT 1;"
```

Vérifie que le dossier choisi est pertinent (réutilisation d'un dossier existant, ou nouveau nom court cohérent).

- [ ] **Step 6: Vérifier le cas d'erreur (URL inaccessible)**

Dans le formulaire, capture avec une URL invalide (ex: `https://exemple-inexistant-xyz123.test/page`). Résultat attendu : message d'erreur explicite affiché en rouge, rien n'est inséré en base.
