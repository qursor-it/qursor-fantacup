import { describe, expect, it } from "vitest";
import { RegisterSchema, LoginSchema } from "./auth-schemas";

describe("RegisterSchema", () => {
  const valid = {
    name: "Mario Rossi",
    email: "mario@example.com",
    password: "password123",
  };

  it("accetta dati validi", () => {
    const result = RegisterSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("minuscola l'email in output", () => {
    const result = RegisterSchema.safeParse({
      ...valid,
      email: "MARIO@Example.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("mario@example.com");
  });

  it("trimma il nome in output", () => {
    const result = RegisterSchema.safeParse({ ...valid, name: "  Mario Rossi  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Mario Rossi");
  });

  describe("name", () => {
    it("rifiuta il nome vuoto", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.name ?? [];
        expect(msgs[0]).toBe("Il nome è obbligatorio.");
      }
    });

    it("rifiuta il nome di un solo carattere", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: "M" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.name ?? [];
        expect(msgs).toContain("Il nome deve avere almeno 2 caratteri.");
      }
    });

    it("rifiuta il nome oltre 30 caratteri", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: "A".repeat(31) });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.name ?? [];
        expect(msgs[0]).toBe("Il nome non può superare i 30 caratteri.");
      }
    });

    it("rifiuta un nome di soli spazi", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: "     " });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.name ?? [];
        expect(msgs[0]).toBe("Il nome è obbligatorio.");
      }
    });

    it("rifiuta un nome che dopo il trim ha un solo carattere", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: " M " });
      expect(result.success).toBe(false);
    });

    it("accetta un nome di esattamente 2 caratteri", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: "Al" });
      expect(result.success).toBe(true);
    });

    it("accetta un nome di esattamente 30 caratteri", () => {
      const result = RegisterSchema.safeParse({ ...valid, name: "A".repeat(30) });
      expect(result.success).toBe(true);
    });
  });

  describe("email", () => {
    it("rifiuta l'email vuota", () => {
      const result = RegisterSchema.safeParse({ ...valid, email: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.email ?? [];
        expect(msgs[0]).toBe("L'email è obbligatoria.");
      }
    });

    it("rifiuta un'email senza @", () => {
      const result = RegisterSchema.safeParse({ ...valid, email: "nonsonemail" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.email ?? [];
        expect(msgs[0]).toBe(
          "Inserisci un indirizzo email valido (es. nome@dominio.it)."
        );
      }
    });

    it("accetta un'email con spazi attorno e la normalizza", () => {
      const result = RegisterSchema.safeParse({ ...valid, email: "  Mario@Example.com " });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.email).toBe("mario@example.com");
    });

    it("rifiuta un'email malformata", () => {
      const result = RegisterSchema.safeParse({ ...valid, email: "mario@" });
      expect(result.success).toBe(false);
    });
  });

  describe("password", () => {
    it("rifiuta una password troppo corta", () => {
      const result = RegisterSchema.safeParse({ ...valid, password: "abc" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const msgs = result.error.flatten().fieldErrors.password ?? [];
        expect(msgs[0]).toBe("La password deve essere di almeno 8 caratteri.");
      }
    });

    it("accetta una password di almeno 8 caratteri", () => {
      const result = RegisterSchema.safeParse({ ...valid, password: "Abc12345" });
      expect(result.success).toBe(true);
    });
  });
});

describe("LoginSchema", () => {
  it("accetta credenziali valide", () => {
    const result = LoginSchema.safeParse({
      email: "mario@example.com",
      password: "qualsiasi",
    });
    expect(result.success).toBe(true);
  });

  it("normalizza email a minuscolo", () => {
    const result = LoginSchema.safeParse({
      email: "MARIO@EXAMPLE.COM",
      password: "qualsiasi",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("mario@example.com");
  });

  it("rifiuta email non valida", () => {
    const result = LoginSchema.safeParse({ email: "nonsonemail", password: "x" });
    expect(result.success).toBe(false);
  });
});
