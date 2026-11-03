import { z } from "zod";

/**
 * Schema di validazione per la registrazione.
 *
 * Nota: in Zod 4 `.trim()` / `.toLowerCase()` sono check di sovrascrittura
 * applicati in ordine: vanno messi PRIMA dei controlli di lunghezza/formato,
 * così un nome di soli spazi fallisce il minimo.
 */
export const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    // Two separate .min() calls intentionally: the first shows "obbligatorio" for
    // an empty field, while the second shows "almeno 2 caratteri" for a one-char
    // input. Zod collects all errors; the UI displays only [0].
    .min(1, { message: "Il nome è obbligatorio." })
    .min(2, { message: "Il nome deve avere almeno 2 caratteri." })
    .max(30, { message: "Il nome non può superare i 30 caratteri." }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { message: "L'email è obbligatoria." })
    .email({ message: "Inserisci un indirizzo email valido (es. nome@dominio.it)." }),
  password: z
    .string()
    .min(8, { message: "La password deve essere di almeno 8 caratteri." })
    .max(72, { message: "Password troppo lunga." }),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
