"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { closeScoringPhase } from "@/lib/scoring-phases";
import type { ActionResult } from "./football-teams";
import { revalidateFantasyPublicPaths } from "./revalidate-public";

async function revalidateScoring() {
  revalidatePath("/admin/fasi-punteggio");
  revalidatePath("/admin");
  revalidatePath("/classifica-fanta");
  revalidatePath("/squadra");
  revalidatePath("/dashboard");
  revalidatePath("/squadre-fanta");
  await revalidateFantasyPublicPaths();
}

const NameSchema = z.object({ name: z.string().min(1, "Nome fase obbligatorio").max(60, "Max 60 caratteri").trim() });

export async function closeScoringPhaseAction(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = NameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const result = await closeScoringPhase(parsed.data.name, Number(admin.id));
  if (!result.ok) return { errors: { name: [result.error] } };
  await revalidateScoring();
  return { message: "Fase chiusa e storico salvato." };
}

/** Elimina solo l'ultima fase (per non rompere il confine delle fasi successive). */
export async function deleteScoringPhase(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));

  const last = await db.scoringPhase.findFirst({ orderBy: { order: "desc" }, select: { id: true } });
  if (!last || last.id !== id) {
    return { message: "Puoi eliminare solo l'ultima fase chiusa." };
  }

  const before = await db.scoringPhase.findUnique({ where: { id } });
  await db.scoringPhase.delete({ where: { id } });
  await logAdminAction(Number(admin.id), "DELETE_SCORING_PHASE", "ScoringPhase", id, before, null);
  await revalidateScoring();
  return {}; // ConfirmDeleteForm mostra `message` come errore: nessun messaggio = successo
}
