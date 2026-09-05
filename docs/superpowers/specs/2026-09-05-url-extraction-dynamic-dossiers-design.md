# Extraction automatique du contenu par URL + dossiers dynamiques

## Contexte

Aujourd'hui, la capture d'une source (`app/capture/page.js`) exige que l'utilisateur colle
lui-même le texte de l'article dans le champ "Contenu", même quand une URL est fournie. Ça
crée de la friction (l'utilisateur a signalé une capture "silencieuse" causée par un champ
Contenu resté vide) et duplique un travail que la page contient déjà.

Par ailleurs, la liste des dossiers de rangement est figée en dur dans `lib/pipeline.js` :
```js
const DOSSIERS = ["IA", "Automatisation", "Design", "Culture", "SEO", "Développement web"];
```
Elle ne couvre pas le pilier "Esports & Valorant" pourtant mentionné dans le prompt système
de `lib/lmstudio.js`, ce qui a mené à un mauvais classement (un article Valorant rangé sous
"Automatisation").

## Objectifs

1. Quand une URL est fournie sans contenu collé, aller chercher et extraire automatiquement
   le texte de la page.
2. Remplacer la liste de dossiers figée par une liste dynamique basée sur les dossiers déjà
   utilisés en base, avec la possibilité pour le modèle d'en proposer un nouveau si aucun ne
   convient.

## Hors périmètre

- Le reclassement de l'article Valorant déjà mal catégorisé (traité séparément, hors spec).
- Le matching sémantique par embeddings pour la détection de doublons de dossiers (jugé trop
  complexe pour le besoin actuel — une normalisation textuelle simple suffit).
- Un mode de secours qui réaffiche le champ Contenu si l'extraction échoue (on préfère un
  échec explicite et une nouvelle tentative par l'utilisateur).

## Design

### 1. Nouveau module `lib/extract.js`

Exporte `extractPageContent(url)` :
- `fetch(url)` avec timeout de 10s (`AbortController`) et un header `User-Agent` de navigateur
  standard, pour limiter les blocages basiques anti-bot.
- Vérifie le `Content-Type` de la réponse ; si ce n'est pas du HTML, lève une erreur explicite.
- Parse le HTML avec **cheerio** (nouvelle dépendance) :
  - Retire `<script>`, `<style>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<noscript>`.
  - Cible en priorité `<article>`, sinon `<main>`, sinon `<body>`.
  - Récupère aussi le `<title>` de la page pour le préfixer au texte extrait (contexte utile
    si le corps manque de titre clair).
- Nettoie le texte (espaces multiples, retours à la ligne), tronque à **~4000 mots** — marge
  de sécurité sous le `ctx-size` de 8192 tokens du modèle local, en laissant de la place au
  prompt système et à la génération de la réponse JSON.
- Si le texte extrait est vide ou l'étape précédente échoue (réseau, timeout, 4xx/5xx,
  content-type invalide) → lève une erreur avec un message clair, par exemple :
  `"Impossible de récupérer le contenu de cette page (playvalorant.com a renvoyé une erreur)"`.

### 2. `lib/pipeline.js` — logique centralisée dans `ingestSource`

`ingestSource({ url, type, rawContent })` change de comportement :
- Si `rawContent` est fourni (non vide) → utilisé tel quel, comme aujourd'hui.
- Si `rawContent` est vide/absent et qu'une `url` est fournie → appel interne à
  `extractPageContent(url)`, dont le résultat devient le `rawContent` utilisé pour la
  qualification.
- Si ni l'un ni l'autre → erreur `"rawContent ou url est requis"` (comportement équivalent à
  l'erreur actuelle, message ajusté).

Toute erreur d'extraction remonte telle quelle à l'appelant (route API), sans traitement
spécial — elle suit le même chemin que les erreurs de qualification existantes.

### 3. `lib/veille.js` — simplification

`runVeille` n'a plus besoin de construire un `rawContent` à partir du titre + extrait RSS.
Chaque item devient :
```js
await ingestSource({ url: item.link, type: "article" });
```
`ingestSource` se charge de l'extraction complète de la page via le même code que la capture
manuelle. Un item dont l'extraction échoue est compté dans `erreurs` (comportement inchangé
du try/catch existant) — le scan continue avec les items suivants.

### 4. `app/capture/page.js` — UI

- Le champ "Contenu" ne s'affiche que lorsque le champ "URL" est vide.
- Dès qu'une URL est saisie, le champ "Contenu" disparaît (et son state est vidé pour ne pas
  envoyer un contenu obsolète si l'utilisateur re-vide l'URL).
- Le bouton "Capturer" reste désactivé tant qu'il n'y a ni URL ni contenu.
- Le body envoyé à `/api/ingest` n'inclut `rawContent` que si le champ est visible et rempli.

### 5. Dossiers dynamiques (`lib/pipeline.js` + `lib/lmstudio.js`)

- Nouvelle fonction `getDossiersExistants()` dans `lib/pipeline.js` : requête Prisma
  `distinct` sur `Article.dossier`, fusionnée avec une liste de départ (seed) —
  `["IA", "Automatisation", "Design", "Culture", "SEO", "Développement web"]` — utilisée
  telle quelle tant que la base est vide, et comme suggestions additionnelles sinon
  (dédupliquée).
- `qualifySource` (dans `lib/lmstudio.js`) reçoit cette liste et le prompt système est
  reformulé pour remplacer l'injonction "choisis parmi cette liste" par : réutiliser un
  dossier existant si le sujet correspond, même partiellement ; sinon proposer un nom court
  (1-3 mots), cohérent avec le style des dossiers existants.
- **Anti-doublons** : avant d'enregistrer l'article, `ingestSource` normalise le nom de
  dossier proposé par le modèle (minuscules, accents retirés, "s" final retiré pour tolérer
  singulier/pluriel) et le compare aux dossiers existants normalisés de la même façon. En cas
  de correspondance, le nom **déjà en base** est utilisé à la place de la nouvelle
  proposition du modèle (préserve l'orthographe canonique existante).

## Nouvelle dépendance

- `cheerio` — parsing HTML léger, pas de DOM complet (contrairement à `jsdom`), suffisant
  pour cibler le contenu principal d'une page.

## Erreurs & cas limites

| Cas | Comportement |
|---|---|
| URL fournie, page inaccessible / timeout / non-HTML | Erreur explicite, rien n'est inséré en base, l'utilisateur peut réessayer |
| URL + contenu collé (ex: appel API direct, hors UI) | Le contenu collé est utilisé, pas de fetch |
| Ni URL ni contenu | Erreur de validation (comportement actuel) |
| Item RSS dont l'extraction échoue | Compté en erreur, le scan continue sur les items suivants |
| Modèle propose un dossier proche d'un existant (casse/pluriel) | Normalisé et fusionné avec le dossier existant |
| Base vide (premier lancement) | Liste de départ (seed) proposée au modèle |
