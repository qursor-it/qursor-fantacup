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

// Login: max 10 tentativi per email+IP ogni 15 minuti.
// La chiave include l'IP: un estraneo non puo bloccare il proprietario da un altro IP.
export const loginEmailIpLimiter = new RateLimiterMemory({
  points: 10,
  duration: 15 * 60,
  blockDuration: 15 * 60,
});

// Login: max 50 tentativi per email ogni 15 minuti (tetto globale contro il guessing distribuito)
export const loginEmailLimiter = new RateLimiterMemory({
  points: 50,
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

const DEFAULT_TRUSTED_PROXY_HOPS = 1;

function trustedProxyHops(): number {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(hops) && hops >= 0 ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * IP del client dagli header della richiesta.
 *
 * x-forwarded-for e una lista "client, proxy1, proxy2, ...": ogni proxy fidato
 * accoda l'IP del peer. Con N proxy fidati davanti al container l'IP reale e
 * l'N-esimo da destra (N=0: si prende comunque il valore piu a destra). Cosi i
 * valori iniettati dal client a sinistra non cambiano il bucket.
 */
export function getClientIp(
  headers: { get(name: string): string | null },
  hops: number = trustedProxyHops()
): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (entries.length > 0) {
      // hops 0 e 1 leggono il valore piu a destra; da 2 in poi si scavalcano i proxy.
      const index = Math.max(0, entries.length - Math.max(1, hops));
      return entries[index];
    }
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/** True se la chiave ha esaurito i punti o e in blocco. Non consuma punti. */
export async function isRateLimited(
  limiter: RateLimiterMemory,
  key: string
): Promise<boolean> {
  const res = await limiter.get(key);
  return res !== null && res.remainingPoints <= 0;
}

/** Consuma un punto ignorando il rifiuto: da usare dopo un tentativo fallito. */
export async function consumeRateLimit(
  limiter: RateLimiterMemory,
  key: string
): Promise<void> {
  try {
    await limiter.consume(key);
  } catch {
    // chiave gia bloccata: nessun punto da consumare
  }
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
