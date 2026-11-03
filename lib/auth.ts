import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  consumeRateLimit,
  getClientIp,
  isRateLimited,
  loginEmailIpLimiter,
  loginEmailLimiter,
  loginIpLimiter,
} from "@/lib/rate-limit";
import { UserRole } from "@prisma/client";

// --- Type augmentation ---

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
  interface User {
    role: UserRole;
  }
}

// Note: next-auth/jwt module augmentation is not supported in this version.
// role and id are stored in the token and accessed via type casting in callbacks.

// --- Custom error for suspended users ---

export class SuspendedUserError extends CredentialsSignin {
  code = "suspended";
}

export class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

async function recordFailedLogin(emailIpKey: string, emailKey: string, ipKey: string) {
  await Promise.all([
    consumeRateLimit(loginEmailIpLimiter, emailIpKey),
    consumeRateLimit(loginEmailLimiter, emailKey),
    consumeRateLimit(loginIpLimiter, ipKey),
  ]);
}

// --- Auth config ---

// Hash bcrypt fittizio (costo 12, come le password reali) usato quando l'email non esiste.
const DUMMY_PASSWORD_HASH = "$2b$12$Q2I5Wsf2kDQdPI/2LVQDj..ZRsOxzuk9zFWaSAJJnaNdtbH3hfyr.";

const SESSION_MAX_AGE = parseInt(
  process.env.AUTH_SESSION_MAX_AGE ?? "2592000",
  10
); // 30 days default

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost:
    process.env.AUTH_TRUST_HOST === "true" || process.env.NODE_ENV !== "production",
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : null;
        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : null;

        if (!email || !password) return null;

        const ip = getClientIp(request.headers);
        const emailIpKey = `login:email-ip:${email}:${ip}`;
        const emailKey = `login:email:${email}`;
        const ipKey = `login:ip:${ip}`;

        // Controllo prima di verificare: un login corretto non consuma punti.
        // I punti si consumano solo sui fallimenti (sotto).
        const blocked = await Promise.all([
          isRateLimited(loginEmailIpLimiter, emailIpKey),
          isRateLimited(loginEmailLimiter, emailKey),
          isRateLimited(loginIpLimiter, ipKey),
        ]);
        if (blocked.some(Boolean)) throw new RateLimitedError();

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          // Stesso costo di un login reale: evita di distinguere le email registrate dai tempi di risposta.
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          await recordFailedLogin(emailIpKey, emailKey, ipKey);
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          await recordFailedLogin(emailIpKey, emailKey, ipKey);
          return null;
        }

        if (user.isSuspended) throw new SuspendedUserError();

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Sign-in: popola il token con i dati utente
        (token as { id: string; role: UserRole }).id = user.id!;
        (token as { id: string; role: UserRole }).role = user.role;
      } else {
        // Richiesta successiva: valida il token contro lo stato DB corrente.
        // Restituire null invalida la sessione (NextAuth v5 cancella il cookie).
        const id = Number((token as { id?: string }).id);
        if (!id) return null;

        const dbUser = await db.user.findUnique({
          where: { id },
          select: { isSuspended: true, passwordChangedAt: true, role: true },
        });

        if (!dbUser || dbUser.isSuspended) return null;

        // Se la password è cambiata dopo l'emissione del token, invalida la sessione.
        const iat = (token as { iat?: number }).iat;
        if (iat && dbUser.passwordChangedAt && dbUser.passwordChangedAt > new Date(iat * 1000)) {
          return null;
        }

        // Il ruolo viene riletto a ogni richiesta: un admin declassato perde subito l'accesso.
        (token as { role: UserRole }).role = dbUser.role;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as { id?: string; role?: UserRole };
      if (t.id) session.user.id = t.id;
      if (t.role) session.user.role = t.role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
