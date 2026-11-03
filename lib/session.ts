import { cache } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
};

/**
 * Restituisce l'utente corrente dalla sessione, o null se non autenticato.
 * Da usare nei Server Components e Server Actions.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name,
    role: session.user.role,
  };
});

/**
 * Richiede autenticazione. Fa redirect a /login se non autenticato.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Richiede ruolo ADMIN. Fa redirect a /dashboard se non admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");
  return user;
}
