import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, mediaMockUploadLimiter } from "@/lib/rate-limit";
import { MOCK_LATENCY_MS, parseMockUploadPayload } from "@/lib/media/mock-upload";
import type { MediaUploadResult } from "@/lib/media/upload";

// Pubblicazione simulata del Media Composer: riceve solo i metadati, non salva nulla e non legge file.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = await checkRateLimit(mediaMockUploadLimiter, `media-mock:${user.id}`);
  if (limit.limited) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter ?? 60) },
    });
  }

  const payload = parseMockUploadPayload(await req.json().catch(() => null));
  if (!payload) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));

  if (payload.simulate === "error") return NextResponse.json({ error: "mock_failure" }, { status: 503 });

  const result: MediaUploadResult = {
    id: `mock-${crypto.randomUUID()}`,
    status: "mocked",
    filename: payload.filename,
    mimeType: payload.mimeType,
    size: payload.size,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
