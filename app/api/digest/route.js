import { envoyerDigest } from "@/lib/digest";

export async function POST() {
    try {
        const result = await envoyerDigest();
        return Response.json(result);
    } catch (err) {
        console.error("Erreur /api/digest :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
