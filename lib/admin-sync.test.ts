import { describe, expect, test } from "vitest";
import { decideAdminSync } from "./admin-sync";

describe("decideAdminSync", () => {
  test("crea l'admin quando non esiste", () => {
    expect(decideAdminSync({ exists: false, role: "", passwordMatches: false })).toEqual([
      "create",
    ]);
  });

  test("non fa nulla quando esiste, è admin e la password combacia", () => {
    expect(
      decideAdminSync({ exists: true, role: "ADMIN", passwordMatches: true })
    ).toEqual([]);
  });

  test("aggiorna la password quando l'admin esiste e la password differisce", () => {
    expect(
      decideAdminSync({ exists: true, role: "ADMIN", passwordMatches: false })
    ).toEqual(["update-password"]);
  });

  test("promuove ad admin quando il ruolo non è ADMIN e la password combacia", () => {
    expect(
      decideAdminSync({ exists: true, role: "USER", passwordMatches: true })
    ).toEqual(["promote"]);
  });

  test("promuove e aggiorna la password quando servono entrambi", () => {
    expect(
      decideAdminSync({ exists: true, role: "USER", passwordMatches: false })
    ).toEqual(["promote", "update-password"]);
  });
});
