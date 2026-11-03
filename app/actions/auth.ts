"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  AUTH_ONBOARDING_PATH,
  resolvePostAuthRedirect,
  sanitizeNextPath,
} from "@/lib/post-auth";
import { RegisterSchema, LoginSchema } from "@/lib/auth-schemas";
import { getRegistrationOpen } from "@/lib/app-settings";
import {
  checkRateLimit,
  getClientIp,
  loginEmailLimiter,
  loginIpLimiter,
  registerIpLimiter,
} from "@/lib/rate-limit";

const TOO_MANY_ATTEMPTS = "Troppi tentativi. Riprova tra qualche minuto.";

export type AuthActionResult = {
  errors?: Record<string, string[]>;
  message?: string;
};

// --- Register ---

export async function register(
  _prev: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  const registrationOpen = await getRegistrationOpen();
  if (!registrationOpen) {
    return { message: "Le registrazioni sono attualmente chiuse." };
  }

  // Rate limit per IP (in memoria, per istanza: vedi lib/rate-limit.ts)
  const ip = getClientIp(await headers());
  const ipLimit = await checkRateLimit(registerIpLimiter, `register:ip:${ip}`);
  if (ipLimit.limited) return { message: TOO_MANY_ATTEMPTS };

  const parsed = RegisterSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { name, email, password } = parsed.data;

  const [existingEmail, existingName] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.user.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);

  if (existingEmail || existingName) {
    return {
      errors: {
        ...(existingEmail ? { email: ["Questa email è già registrata."] } : {}),
        ...(existingName ? { name: ["Questo nome è già in uso. Scegline un altro."] } : {}),
      },
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user: { role: UserRole };
  try {
    user = await db.user.create({
      data: { email, passwordHash, name },
      select: { role: true },
    });
  } catch (e) {
    // Registrazione concorrente con la stessa email: vincolo unique sul DB.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { email: ["Questa email è già registrata."] } };
    }
    throw e;
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { message: "Registrazione completata, ma l'avvio automatico della sessione è fallito. Effettua il login manualmente." };
    }
    throw e;
  }

  redirect(
    resolvePostAuthRedirect({
      role: user.role,
      hasFantasyTeam: false,
      next: AUTH_ONBOARDING_PATH,
    })
  );
}

// --- Login ---

export async function login(
  _prev: AuthActionResult | undefined,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: "Credenziali non valide." };
  }

  // Rate limit per email e per IP (in memoria, per istanza: vedi lib/rate-limit.ts)
  const ip = getClientIp(await headers());
  const [emailLimit, ipLimit] = await Promise.all([
    checkRateLimit(loginEmailLimiter, `login:email:${parsed.data.email.toLowerCase()}`),
    checkRateLimit(loginIpLimiter, `login:ip:${ip}`),
  ]);
  if (emailLimit.limited || ipLimit.limited) {
    return { message: TOO_MANY_ATTEMPTS };
  }

  const existingUser = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, role: true, fantasyTeam: { select: { id: true } } },
  });

  const safeNext = sanitizeNextPath(formData.get("next"));

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      if (e.type === "CredentialsSignin" && (e as { cause?: { err?: { code?: string } } }).cause?.err?.code === "suspended") {
        return { message: "Account sospeso. Contatta un amministratore." };
      }
      return { message: "Email o password non corretti." };
    }
    throw e;
  }

  redirect(
    resolvePostAuthRedirect({
      role: existingUser?.role ?? UserRole.USER,
      hasFantasyTeam: !!existingUser?.fantasyTeam,
      next: safeNext,
    })
  );
}

// --- Logout ---

export async function logout() {
  await signOut({ redirectTo: "/" });
}
