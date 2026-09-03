const cron = require("node-cron");

const APP_URL = "http://localhost:3000/api/veille";
const DIGEST_URL = "http://localhost:3000/api/digest";

async function lancerVeille() {
    console.log(`[${new Date().toISOString()}] Lancement de la veille automatique...`);
    try {
        const res = await fetch(APP_URL, { method: "POST" });
        const data = await res.json();
        console.log("Résultat :", data);
    } catch (err) {
        console.error("Erreur lors du scan :", err.message);
    }

    try {
        const res = await fetch(DIGEST_URL, { method: "POST" });
        const data = await res.json();
        console.log("Digest :", data);
    } catch (err) {
        console.error("Erreur lors de l'envoi du digest :", err.message);
    }
}

// Planifie toutes les 24h, à 8h du matin
cron.schedule("0 8 * * *", lancerVeille);

console.log("Planificateur démarré — veille automatique tous les jours à 8h.");

// Décommente cette ligne pour lancer un scan tout de suite, en plus du planning :
// lancerVeille();