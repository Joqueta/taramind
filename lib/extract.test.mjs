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
