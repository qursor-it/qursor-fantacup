import { z } from "zod";

const BANNED_WORDS = ["merda", "cazzo", "vaffanculo", "stronzo", "puttana"];

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
};

/**
 * Normalizza un testo per il filtro parole: minuscolo, senza accenti,
 * leetspeak comune convertito in lettere, lettere ripetute collassate
 * (es. "M3rdaaa" -> "merda", "cazzo" -> "cazo").
 */
export function normalizeForBadWords(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[013457@$]/g, (ch) => LEET_MAP[ch] ?? ch)
    .replace(/([a-z])\1+/g, "$1");
}

const BANNED_PATTERNS = BANNED_WORDS.map(
  (word) => new RegExp(`(^|[^a-z])${normalizeForBadWords(word)}([^a-z]|$)`)
);

/** True se il testo contiene una parola non consentita (dopo normalizzazione). */
export function containsBannedWord(text: string): boolean {
  const normalized = normalizeForBadWords(text);
  return BANNED_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Regola di validazione del nome di una squadra fanta.
 * Condivisa tra la creazione lato utente e la modifica lato admin.
 * Il trim avviene prima dei controlli di lunghezza: un nome di soli spazi fallisce.
 */
export const fantasyTeamNameSchema = z
  .string()
  .trim()
  .min(1, "Nome obbligatorio")
  .max(40, "Max 40 caratteri")
  .refine((n) => !containsBannedWord(n), {
    message: "Il nome contiene parole non consentite.",
  });
