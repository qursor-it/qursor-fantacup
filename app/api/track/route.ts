import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp, trackLimiter } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit per IP (in memoria, per istanza: vedi lib/rate-limit.ts).
  // Se limitato non incrementa il contatore visite.
  const limit = await checkRateLimit(trackLimiter, `track:ip:${getClientIp(req.headers)}`);
  if (limit.limited) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfter ?? 60) },
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  await db.siteVisit.upsert({
    where: { date },
    update: { count: { increment: 1 } },
    create: { date, count: 1 },
  });
  return NextResponse.json({ ok: true });
}
