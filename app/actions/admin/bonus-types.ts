"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import type { ActionResult } from "./football-teams";
import { revalidateBonusPublicPaths, revalidateFantasyPublicPaths } from "./revalidate-public";

/** Codice riservato: il tipo MVP è usato dal calcolo punteggi (lib/scoring.ts). */
const MVP_CODE = "MVP";
/** BonusType.points è Decimal(5, 2). */
const MAX_POINTS = 999.99;

const Schema = z.object({
  code: z.string().min(1).toUpperCase().trim(),
  name: z.string().min(1, "Nome obbligatorio").trim(),
  points: z.coerce
    .number({ error: "Valore numerico richiesto" })
    .min(-MAX_POINTS, `Valore minimo -${MAX_POINTS}`)
    .max(MAX_POINTS, `Valore massimo ${MAX_POINTS}`),
  isSecret: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
});

/** true se l'errore è una violazione di vincolo univoco (code/name duplicati). */
function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createBonusType(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = Schema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    points: formData.get("points"),
    isSecret: formData.get("isSecret"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  let bt;
  try {
    bt = await db.bonusType.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) return { message: "Esiste già un tipo bonus con questo codice o nome." };
    throw e;
  }
  await logAdminAction(Number(admin.id), "CREATE", "BonusType", bt.id, null, bt);

  revalidatePath("/admin/bonus-types");
  revalidateBonusPublicPaths();
  return {};
}

export async function updateBonusType(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Bonus type non valido." };
  const parsed = Schema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    points: formData.get("points"),
    isSecret: formData.get("isSecret"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const before = await db.bonusType.findUnique({ where: { id } });
  if (!before) return { message: "Bonus type non trovato." };
  if (before.code === MVP_CODE && parsed.data.code !== MVP_CODE) {
    return { errors: { code: [`Il codice ${MVP_CODE} è riservato e non può essere modificato.`] } };
  }

  let bt;
  try {
    bt = await db.bonusType.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) return { message: "Esiste già un tipo bonus con questo codice o nome." };
    throw e;
  }
  await logAdminAction(Number(admin.id), "UPDATE", "BonusType", id, before, bt);

  revalidatePath("/admin/bonus-types");
  revalidateBonusPublicPaths();
  // Il punteggio MVP è letto dal tipo bonus al momento del calcolo; nome/codice
  // e visibilità compaiono nei dettagli fantasy: invalida sempre classifiche e snapshot.
  await revalidateFantasyPublicPaths();
  return {};
}

export async function deleteBonusType(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Bonus type non valido." };

  const before = await db.bonusType.findUnique({ where: { id } });
  if (!before) return { message: "Bonus type non trovato." };
  if (before.code === MVP_CODE) {
    return { message: `Il tipo bonus ${MVP_CODE} è usato dal calcolo punteggi e non può essere eliminato.` };
  }

  try {
    await db.bonusType.delete({ where: { id } });
    await logAdminAction(Number(admin.id), "DELETE", "BonusType", id, before, null);
  } catch {
    return { message: "Impossibile eliminare: il bonus type è già assegnato a delle partite." };
  }

  revalidatePath("/admin/bonus-types");
  revalidateBonusPublicPaths();
  await revalidateFantasyPublicPaths();
  return {};
}
