"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import type { ActionResult } from "./football-teams";
import { revalidateFantasyPublicPaths } from "./revalidate-public";

function isPositiveId(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

export async function suspendUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!isPositiveId(userId)) return { message: "Utente non valido." };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { message: "Utente non trovato." };
  if (user.id === Number(admin.id)) return { message: "Non puoi sospendere te stesso." };
  if (user.role === UserRole.ADMIN) {
    return { message: "Non puoi sospendere un admin: rimuovi prima i privilegi admin." };
  }
  if (user.isSuspended) return { message: "Utente già sospeso." };

  await db.user.update({ where: { id: userId }, data: { isSuspended: true } });
  await logAdminAction(Number(admin.id), "SUSPEND_USER", "User", userId, { isSuspended: false }, { isSuspended: true });

  revalidatePath("/admin/utenti");
  revalidatePath(`/admin/utenti/${userId}`);
  return {};
}

export async function unsuspendUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!isPositiveId(userId)) return { message: "Utente non valido." };

  const user = await db.user.findUnique({ where: { id: userId }, select: { isSuspended: true } });
  if (!user) return { message: "Utente non trovato." };
  if (!user.isSuspended) return { message: "Utente non sospeso." };

  await db.user.update({ where: { id: userId }, data: { isSuspended: false } });
  await logAdminAction(Number(admin.id), "UNSUSPEND_USER", "User", userId, { isSuspended: true }, { isSuspended: false });

  revalidatePath("/admin/utenti");
  revalidatePath(`/admin/utenti/${userId}`);
  return {};
}

export async function promoteToAdmin(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!isPositiveId(userId)) return { message: "Utente non valido." };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { message: "Utente non trovato." };
  if (user.role === UserRole.ADMIN) return { message: "Utente già admin." };

  await db.user.update({ where: { id: userId }, data: { role: UserRole.ADMIN } });
  await logAdminAction(Number(admin.id), "PROMOTE_ADMIN", "User", userId, { role: "USER" }, { role: "ADMIN" });

  revalidatePath("/admin/utenti");
  revalidatePath(`/admin/utenti/${userId}`);
  return {};
}

export async function demoteToUser(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const userId = Number(formData.get("userId"));
  if (!isPositiveId(userId)) return { message: "Utente non valido." };

  if (userId === Number(admin.id)) return { message: "Non puoi rimuovere i tuoi privilegi admin." };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { message: "Utente non trovato." };
  if (user.role !== UserRole.ADMIN) return { message: "L'utente non è un admin." };

  const adminCount = await db.user.count({ where: { role: UserRole.ADMIN } });
  if (adminCount <= 1) return { message: "Non puoi rimuovere l'ultimo admin." };

  await db.user.update({ where: { id: userId }, data: { role: UserRole.USER } });
  await logAdminAction(Number(admin.id), "DEMOTE_USER", "User", userId, { role: "ADMIN" }, { role: "USER" });

  revalidatePath("/admin/utenti");
  revalidatePath(`/admin/utenti/${userId}`);
  return {};
}

const CreateAdminSchema = z.object({
  email: z.string().email("Email non valida").trim().toLowerCase(),
  password: z.string().min(8, "Password min 8 caratteri"),
  name: z.string().trim().optional(),
});

const SetPasswordSchema = z
  .object({
    userId: z.coerce.number().int().positive(),
    newPassword: z
      .string()
      .min(8, "La password deve avere almeno 8 caratteri.")
      .max(72, "Password troppo lunga."),
    confirmPassword: z.string().min(1, "Conferma la password."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Le password non coincidono.",
    path: ["confirmPassword"],
  });

export async function adminSetPassword(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = SetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { userId, newPassword } = parsed.data;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { message: "Utente non trovato." };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } });
  await logAdminAction(Number(admin.id), "SET_PASSWORD", "User", userId, null, { passwordChanged: true });

  revalidatePath(`/admin/utenti/${userId}`);
  return { message: "Password aggiornata con successo." };
}

export type AdminDeleteUserResult = { error?: string; success?: boolean };

export async function adminDeleteUser(
  _prev: AdminDeleteUserResult | undefined,
  formData: FormData
): Promise<AdminDeleteUserResult> {
  const admin = await requireAdmin();

  const userId = Number(formData.get("userId"));
  if (!isPositiveId(userId)) return { error: "Utente non valido." };

  const targetUser = await db.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: "Utente non trovato." };
  if (targetUser.role !== UserRole.USER) return { error: "Non puoi eliminare un admin." };
  if (targetUser.id === Number(admin.id)) return { error: "Non puoi eliminare te stesso." };

  await logAdminAction(
    Number(admin.id),
    "DELETE_USER",
    "User",
    userId,
    { email: targetUser.email, role: targetUser.role, name: targetUser.name },
    null
  );

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin/utenti");
  revalidatePath("/admin/squadre-fantasy");
  // La cancellazione rimuove in cascata la squadra fantasy dell'utente.
  await revalidateFantasyPublicPaths();
  return { success: true };
}

export async function createAdmin(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = CreateAdminSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { errors: { email: ["Email già registrata."] } };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const newAdmin = await db.user.create({
    data: { email: parsed.data.email, passwordHash, name: parsed.data.name, role: UserRole.ADMIN },
  });
  await logAdminAction(Number(admin.id), "CREATE_ADMIN", "User", newAdmin.id, null, { email: newAdmin.email, role: newAdmin.role });

  revalidatePath("/admin/utenti");
  return { message: `Admin ${newAdmin.email} creato.` };
}
