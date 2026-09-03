import { prisma } from "./prisma";
import { envoyerEmail } from "./mailer";
import { MOTS_CLES } from "@/config/motsCles";

const NB_ARTICLES_DIGEST = 5;

function contientMotCle(article) {
    const texte = `${article.titre} ${article.interet}`.toLowerCase();
    return MOTS_CLES.filter((mc) => texte.includes(mc.toLowerCase()));
}

function ligneArticle(a) {
    const lien = a.source?.url
        ? `<a href="${a.source.url}">${a.titre}</a>`
        : a.titre;
    const mots = contientMotCle(a);
    const suffixeMotsCles = mots.length > 0 ? ` — <strong>${mots.join(", ")}</strong>` : "";
    return `<li>${lien} <span style="color:#888">(${a.dossier}, score ${a.interetScore ?? "?"}/5)</span>${suffixeMotsCles}</li>`;
}

function construireHtml(articles, totalNouveaux) {
    let html = `<h1>Veille du jour</h1>`;
    html += `<p>Top ${articles.length} article${articles.length > 1 ? "s" : ""} (sur ${totalNouveaux} nouveau${totalNouveaux > 1 ? "x" : ""} depuis le dernier envoi), classé${articles.length > 1 ? "s" : ""} par score d'intérêt.</p>`;
    html += `<ul>${articles.map(ligneArticle).join("")}</ul>`;

    return html;
}

/**
 * Construit et envoie le digest : les 5 meilleurs articles (score d'intérêt
 * le plus haut) parmi ceux jamais encore envoyés dans un digest précédent.
 * Une fois envoyés (ou non retenus), tous les candidats de ce lot sont
 * marqués comme traités pour ne jamais réapparaître dans un digest suivant.
 * N'envoie rien s'il n'y a aucun article nouveau (évite le bruit les jours creux).
 * @returns {Promise<{envoye: boolean, nbArticles: number}>}
 */
export async function envoyerDigest() {
    const nouveauxArticles = await prisma.article.findMany({
        where: { envoyeDigest: false },
        include: { source: true },
        orderBy: [{ interetScore: "desc" }, { createdAt: "desc" }],
    });

    if (nouveauxArticles.length === 0) {
        return { envoye: false, nbArticles: 0 };
    }

    const top = nouveauxArticles.slice(0, NB_ARTICLES_DIGEST);

    await envoyerEmail({
        subject: `Veille du jour — top ${top.length} article${top.length > 1 ? "s" : ""}`,
        html: construireHtml(top, nouveauxArticles.length),
    });

    await prisma.article.updateMany({
        where: { id: { in: nouveauxArticles.map((a) => a.id) } },
        data: { envoyeDigest: true },
    });

    return { envoye: true, nbArticles: top.length };
}
