import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import type { SessionUser } from "@/lib/session";

// Token breve per il servizio stories (Quarkus, cartella quarkus/), che lo verifica con la chiave pubblica.
// issuer e audience devono combaciare con quarkus/src/main/resources/application.properties.
export const STORIES_TOKEN_ISSUER = "qursor-fantacup";
export const STORIES_TOKEN_AUDIENCE = "stories";
export const STORIES_TOKEN_TTL_SECONDS = 300;

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export function signStoriesToken(
  user: Pick<SessionUser, "id" | "email" | "role">,
  privateKeyPem: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
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
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), createPrivateKey(privateKeyPem));
  return `${header}.${payload}.${base64url(signature)}`;
}
