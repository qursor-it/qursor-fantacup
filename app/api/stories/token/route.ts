import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { signStoriesToken, storiesPrivateKey, STORIES_TOKEN_TTL_SECONDS } from "@/lib/stories-token";

// Il browser chiede qui un token breve e lo manda al servizio stories come "Authorization: Bearer".
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const privateKey = storiesPrivateKey();
  if (!privateKey) return NextResponse.json({ error: "stories_not_configured" }, { status: 503 });

  return NextResponse.json(
    { token: signStoriesToken(user, privateKey), expiresIn: STORIES_TOKEN_TTL_SECONDS },
    { headers: { "Cache-Control": "no-store" } }
  );
}
