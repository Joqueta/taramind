const cron = require("node-cron");

const APP_URL = "http://localhost:3000/api/veille";

async function lancerVeille() {
    console.log(`[${new Date().toISOString()}] Lancement de la veille automatique...`);
    try {
        const res = await fetch(APP_URL, { method: "POST" });
        const data = await res.json();
        console.log("Résultat :", data);
    } catch (err) {
        console.error("Erreur lors du scan :", err.message);
    }
}

// Planifie toutes les 24h (à minuit)
cron.schedule("0 0 * * *", lancerVeille);

console.log("Planificateur démarré — veille automatique toutes les 24h.");
console.log("Pour tester immédiatement, décommente la ligne ci-dessous.");

// Décommente cette ligne pour lancer un scan tout de suite, en plus du planning :
lancerVeille();