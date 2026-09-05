import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText, MAX_WORDS, extractPageContent } from "./extract.mjs";

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
    assert.equal(result.trim().split(/\s+/).length, MAX_WORDS);
});

test("htmlToText truncates correctly with title and body", () => {
    const words = Array.from({ length: MAX_WORDS + 1000 }, (_, i) => `mot${i}`).join(" ");
    const html = `<html><head><title>Title Word</title></head><body><article><p>${words}</p></article></body></html>`;
    const result = htmlToText(html);
    // Should have exactly MAX_WORDS total including title words
    assert.equal(result.trim().split(/\s+/).length, MAX_WORDS);
});

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

test("extractPageContent wraps an abort during the body read as a timeout error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            throw err;
        },
    });

    try {
        await assert.rejects(() => extractPageContent("https://example.com/slow-body"), /Timeout/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("extractPageContent wraps a body read failure as a clear French error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => {
            throw new Error("stream prematurely closed");
        },
    });

    try {
        await assert.rejects(
            () => extractPageContent("https://example.com/broken-stream"),
            /Erreur lors de la lecture de/,
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});
