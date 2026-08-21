import { ingestSource } from "@/lib/pipeline";

export async function POST(req) {
    try {
        const body = await req.json();
        const result = await ingestSource(body);
        return Response.json(result);
    } catch (err) {
        console.error("Erreur /api/ingest :", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}