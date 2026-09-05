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
