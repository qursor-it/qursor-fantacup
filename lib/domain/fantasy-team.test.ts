import { describe, expect, it } from "vitest";
import { containsBannedWord, fantasyTeamNameSchema, normalizeForBadWords } from "./fantasy-team";

describe("fantasyTeamNameSchema", () => {
  it("accetta un nome valido e lo trimma", () => {
    const result = fantasyTeamNameSchema.safeParse("  Real Bar  ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("Real Bar");
  });

  it("rifiuta un nome di soli spazi", () => {
    expect(fantasyTeamNameSchema.safeParse("    ").success).toBe(false);
  });

  it("rifiuta nomi oltre 40 caratteri", () => {
    expect(fantasyTeamNameSchema.safeParse("a".repeat(41)).success).toBe(false);
  });

  it("rifiuta parole non consentite", () => {
    expect(fantasyTeamNameSchema.safeParse("FC Merda").success).toBe(false);
  });
});

describe("containsBannedWord", () => {
  it.each(["merda", "MERDA", "m3rd4", "Mèrda", "merdaaaa", "c4zz0 team", "$tronzo", "putt@na", "Str0nz0 FC"])(
    "rileva %s",
    (text) => {
      expect(containsBannedWord(text)).toBe(true);
    }
  );

  it.each(["Real Bar", "Atletico Mezzanotte", "Cazzola United", "Merdale"])("non segnala %s", (text) => {
    expect(containsBannedWord(text)).toBe(false);
  });
});

describe("normalizeForBadWords", () => {
  it("collassa ripetizioni e leetspeak", () => {
    expect(normalizeForBadWords("C4ZZZ00")).toBe("cazo");
  });
});
