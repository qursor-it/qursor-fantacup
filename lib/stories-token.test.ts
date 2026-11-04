import { readFileSync } from "node:fs";
import { createPublicKey, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { signStoriesToken, storiesPublicJwk } from "./stories-token";

// Stessa coppia di chiavi usata dai test Quarkus.
const privateKey = readFileSync("quarkus/dev-keys/privateKey.pem", "utf8");

describe("signStoriesToken", () => {
  it("firma un JWT RS256 con i claim attesi da Quarkus", () => {
    const token = signStoriesToken({ id: "42", email: "mario@example.com", role: "USER" }, privateKey, 1000);
    const [header, payload, signature] = token.split(".");
    const jwk = storiesPublicJwk(privateKey);

    // Verifica con la chiave pubblicata nel JWKS, come fa Quarkus.
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    expect(verify("sha256", Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, "base64url"))).toBe(true);
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT", kid: jwk.kid });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString())).toEqual({
      iss: "qursor-fantacup",
      aud: "stories",
      sub: "42",
      upn: "mario@example.com",
      groups: ["USER"],
      iat: 1000,
      exp: 1300,
    });
  });

  it("il JWKS espone solo la parte pubblica della chiave", () => {
    const jwk = storiesPublicJwk(privateKey);
    expect(Object.keys(jwk).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
    expect(createPublicKey(readFileSync("quarkus/dev-keys/publicKey.pem", "utf8")).export({ format: "jwk" }).n).toBe(jwk.n);
  });
});
