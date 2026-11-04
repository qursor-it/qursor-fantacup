import { NextResponse } from "next/server";
import { storiesPrivateKey, storiesPublicJwk } from "@/lib/stories-token";

// Chiave pubblica per il servizio stories (Quarkus la scarica e la tiene in cache). Pubblica per definizione.
export async function GET() {
  const privateKey = storiesPrivateKey();
  if (!privateKey) return NextResponse.json({ error: "stories_not_configured" }, { status: 503 });

  return NextResponse.json(
    { keys: [storiesPublicJwk(privateKey)] },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
