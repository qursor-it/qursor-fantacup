import { RateLimiterMemory } from "rate-limiter-flexible";

// NB: RateLimiterMemory e per-istanza (memoria del processo Node). Con piu
// istanze/serverless ogni istanza ha i propri contatori: e una protezione
// "best effort" contro abusi banali, non un limite globale garantito.

// Voto MVP: max 5 tentativi per utente all'ora (la unicità reale è sul DB)
export const voteLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600,
  blockDuration: 3600,
});

// Cambio password: max 5 tentativi per utente all'ora
export const passwordChangeLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600,
  blockDuration: 3600,
});

// Cancellazione account: max 5 tentativi per utente all'ora
export const deleteAccountLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600,
  blockDuration: 3600,
});

// Login: max 10 tentativi per email ogni 15 minuti
export const loginEmailLimiter = new RateLimiterMemory({
  points: 10,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

// Login: max 30 tentativi per IP ogni 15 minuti
export const loginIpLimiter = new RateLimiterMemory({
  points: 30,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

// Registrazione: max 5 account per IP all'ora
export const registerIpLimiter = new RateLimiterMemory({
  points: 5,
  duration: 3600,
  blockDuration: 3600,
});

// Immagine story: max 30 richieste per IP al minuto
export const storyImageLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
});

// Tracking eventi: max 30 richieste per IP al minuto
export const trackLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60,
});

/**
 * IP del client dagli header della richiesta: primo valore di x-forwarded-for,
 * poi x-real-ip. Gli header sono falsificabili se non impostati da un proxy
 * fidato: va bene come chiave di rate limit "best effort".
 */
export function getClientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export async function checkRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<{ limited: boolean; retryAfter?: number }> {
  try {
    await limiter.consume(key);
    return { limited: false };
  } catch (e: unknown) {
    const msBeforeNext =
      e && typeof e === "object" && "msBeforeNextReset" in e
        ? (e as { msBeforeNextReset: number }).msBeforeNextReset
        : 0;
    return {
      limited: true,
      retryAfter: Math.ceil(msBeforeNext / 1000),
    };
  }
}
