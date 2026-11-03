import { UserRole } from "@prisma/client";

export const AUTH_ONBOARDING_PATH = "/squadra/crea";

export function sanitizeNextPath(next: FormDataEntryValue | null | undefined) {
  if (typeof next !== "string") {
    return "";
  }

  // Solo percorsi interni. "/\evil.com" e simili vengono interpretati dai browser
  // come URL protocol-relative: si normalizza con URL e si accetta solo la stessa origine.
  if (!next.startsWith("/") || /[\\\u0000-\u001f]/.test(next)) {
    return "";
  }
  try {
    const base = "http://internal.invalid";
    const url = new URL(next, base);
    if (url.origin !== base) return "";
    return url.pathname + url.search + url.hash;
  } catch {
    return "";
  }
}

export function resolvePostAuthRedirect({
  role,
  hasFantasyTeam,
  next,
}: {
  role: UserRole;
  hasFantasyTeam: boolean;
  next?: string;
}) {
  if (role === UserRole.ADMIN) {
    return next || "/admin";
  }

  if (!hasFantasyTeam) {
    return AUTH_ONBOARDING_PATH;
  }

  return next || "/dashboard";
}
