import { describe, expect, test } from "vitest";
import { decideAdminSync, type AdminSyncInput } from "./admin-sync";

const noExisting: AdminSyncInput["existingWithEnvEmail"] = {
  exists: false,
  isManaged: false,
  passwordMatches: false,
};

function managed(overrides: {
  emailMatches?: boolean;
  roleIsAdmin?: boolean;
  credentialMatchesProvisioned?: boolean;
} = {}): AdminSyncInput {
  return {
    managedCount: 1,
    managed: {
      emailMatches: true,
      roleIsAdmin: true,
      credentialMatchesProvisioned: true,
      ...overrides,
    },
    existingWithEnvEmail: { exists: true, isManaged: true, passwordMatches: true },
  };
}

describe("decideAdminSync", () => {
  test("primo deploy: crea l'admin quando non esiste", () => {
    expect(
      decideAdminSync({
        managedCount: 0,
        managed: null,
        existingWithEnvEmail: noExisting,
      })
    ).toEqual({ ok: true, actions: ["create"] });
  });

  test("primo deploy: adotta l'admin esistente con la stessa password (nessun logout)", () => {
    expect(
      decideAdminSync({
        managedCount: 0,
        managed: null,
        existingWithEnvEmail: { exists: true, isManaged: false, passwordMatches: true },
      })
    ).toEqual({ ok: true, actions: ["adopt"] });
  });

  test("primo deploy: adotta l'admin esistente con password diversa (logout)", () => {
    expect(
      decideAdminSync({
        managedCount: 0,
        managed: null,
        existingWithEnvEmail: { exists: true, isManaged: false, passwordMatches: false },
      })
    ).toEqual({ ok: true, actions: ["adopt", "adopt-set-password-changed-at"] });
  });

  test("deploy invariato dopo cambio password da UI: nessuna azione", () => {
    expect(
      decideAdminSync({
        managedCount: 1,
        managed: {
          emailMatches: true,
          roleIsAdmin: true,
          credentialMatchesProvisioned: true,
        },
        existingWithEnvEmail: { exists: true, isManaged: true, passwordMatches: false },
      })
    ).toEqual({ ok: true, actions: [] });
  });

  test("credenziale ruotata: ruota la password", () => {
    expect(
      decideAdminSync(
        managed({ credentialMatchesProvisioned: false })
      )
    ).toEqual({ ok: true, actions: ["rotate-password"] });
  });

  test("email cambiata: rinomina lo stesso account", () => {
    expect(
      decideAdminSync({
        managedCount: 1,
        managed: {
          emailMatches: false,
          roleIsAdmin: true,
          credentialMatchesProvisioned: true,
        },
        existingWithEnvEmail: noExisting,
      })
    ).toEqual({ ok: true, actions: ["rename-email"] });
  });

  test("email cambiata ma già usata da un altro utente: errore", () => {
    expect(
      decideAdminSync({
        managedCount: 1,
        managed: {
          emailMatches: false,
          roleIsAdmin: true,
          credentialMatchesProvisioned: true,
        },
        existingWithEnvEmail: { exists: true, isManaged: false, passwordMatches: false },
      })
    ).toEqual({ ok: false, error: "email-owned-by-other" });
  });

  test("più account gestiti dal deploy: errore", () => {
    expect(
      decideAdminSync({
        managedCount: 2,
        managed: {
          emailMatches: true,
          roleIsAdmin: true,
          credentialMatchesProvisioned: true,
        },
        existingWithEnvEmail: { exists: true, isManaged: true, passwordMatches: true },
      })
    ).toEqual({ ok: false, error: "multiple-managed" });
  });

  test("admin managed declassato: lo promuove", () => {
    expect(decideAdminSync(managed({ roleIsAdmin: false }))).toEqual({
      ok: true,
      actions: ["promote"],
    });
  });

  test("combina rinomina, promozione e rotazione", () => {
    expect(
      decideAdminSync({
        managedCount: 1,
        managed: {
          emailMatches: false,
          roleIsAdmin: false,
          credentialMatchesProvisioned: false,
        },
        existingWithEnvEmail: noExisting,
      })
    ).toEqual({
      ok: true,
      actions: ["rename-email", "promote", "rotate-password"],
    });
  });
});
