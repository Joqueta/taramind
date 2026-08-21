import { runVeille } from "@/lib/veille";

export async function POST() {
    try {
        const result = await runVeille();
        return Response.json(result);
    } catch (err) {
        console.error("Erreur /api/veille :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}