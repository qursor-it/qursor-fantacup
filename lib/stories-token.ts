import "server-only";
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import type { SessionUser } from "@/lib/session";

// Token breve per il servizio stories (Quarkus, cartella quarkus/), che scarica la chiave pubblica da /api/stories/jwks.
// issuer e audience devono combaciare con quarkus/src/main/resources/application.properties.
export const STORIES_TOKEN_ISSUER = "qursor-fantacup";
export const STORIES_TOKEN_AUDIENCE = "stories";
export const STORIES_TOKEN_TTL_SECONDS = 300;

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** Chiave pubblica in formato JWK, con kid = thumbprint RFC 7638: cambia da solo quando si cambia chiave. */
export function storiesPublicJwk(privateKeyPem: string) {
  const { kty, n, e } = createPublicKey(createPrivateKey(privateKeyPem)).export({ format: "jwk" });
  const kid = createHash("sha256").update(JSON.stringify({ e, kty, n })).digest("base64url");
  return { kty, n, e, kid, alg: "RS256", use: "sig" };
}

export function signStoriesToken(
  user: Pick<SessionUser, "id" | "email" | "role">,
  privateKeyPem: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const key = createPrivateKey(privateKeyPem);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: storiesPublicJwk(privateKeyPem).kid }));
  const payload = base64url(
    JSON.stringify({
      iss: STORIES_TOKEN_ISSUER,
      aud: STORIES_TOKEN_AUDIENCE,
      sub: user.id,
      upn: user.email,
      groups: [user.role],
      iat: nowSeconds,
      exp: nowSeconds + STORIES_TOKEN_TTL_SECONDS,
    })
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${base64url(signature)}`;
}

/** Legge STORIES_JWT_PRIVATE_KEY (PEM, a capo scritti anche come \n); null se il servizio stories non e configurato. */
export function storiesPrivateKey(): string | null {
  return process.env.STORIES_JWT_PRIVATE_KEY?.replace(/\\n/g, "\n") || null;
}
