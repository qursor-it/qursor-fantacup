"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { closeScoringPhase } from "@/lib/scoring-phases";
import type { ActionResult } from "./football-teams";
import { revalidateFantasyPublicPaths } from "./revalidate-public";

const SetSchema = z
  .object({
    opensAt: z.coerce.date({ message: "Data di apertura non valida" }),
    closesAt: z.coerce.date({ message: "Data di chiusura non valida" }),
    maxChanges: z.coerce.number().int().min(0, "Deve essere >= 0").max(5, "Massimo 5"),
    saveScoringSnapshot: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()),
    phaseName: z.string().trim().optional(),
  })
  .refine((d) => d.closesAt > d.opensAt, {
    message: "La chiusura deve essere successiva all'apertura",
    path: ["closesAt"],
  })
  .refine((d) => !d.saveScoringSnapshot || (d.phaseName && d.phaseName.length > 0), {
    message: "Inserisci il nome della fase da salvare",
    path: ["phaseName"],
  });

/**
 * Crea o aggiorna la finestra di modifica rosa. Per evitare finestre sovrapposte,
 * se esiste già una finestra non ancora chiusa la si aggiorna anziché crearne una nuova.
 */
export async function setRosterEditWindow(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const parsed = SetSchema.safeParse({
    opensAt: formData.get("opensAt"),
    closesAt: formData.get("closesAt"),
    maxChanges: formData.get("maxChanges"),
    saveScoringSnapshot: formData.get("saveScoringSnapshot"),
    phaseName: formData.get("phaseName"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { opensAt, closesAt, maxChanges, saveScoringSnapshot, phaseName } = parsed.data;
  const now = new Date();

  // Snapshot dello stato pre-mercato: congela la fase corrente PRIMA che gli
  // utenti possano cambiare rosa.
  if (saveScoringSnapshot && phaseName) {
    const result = await closeScoringPhase(phaseName, Number(admin.id));
    if (!result.ok) return { errors: { phaseName: [result.error] } };
    revalidatePath("/classifica-fanta");
    revalidatePath("/dashboard");
    revalidatePath("/admin/fasi-punteggio");
    await revalidateFantasyPublicPaths();
  }

  const { id: windowId, before, after } = await db.$transaction(async (tx) => {
    const existing = await tx.rosterEditWindow.findFirst({
      where: { closesAt: { gt: now } },
      orderBy: { opensAt: "desc" },
    });

    if (existing) {
      const updated = await tx.rosterEditWindow.update({
        where: { id: existing.id },
        data: { opensAt, closesAt, maxChanges },
      });
      return { id: existing.id, before: existing, after: updated };
    }

    const created = await tx.rosterEditWindow.create({
      data: { opensAt, closesAt, maxChanges, createdById: Number(admin.id) },
    });
    return { id: created.id, before: null, after: created };
  });

  await logAdminAction(Number(admin.id), "SET_ROSTER_WINDOW", "RosterEditWindow", windowId, before, after);

  revalidatePath("/admin/modifiche-rosa");
  revalidatePath("/squadra");
  return { message: "Finestra salvata." };
}

/** Chiude immediatamente la finestra attiva (closesAt = ora). */
export async function closeRosterEditWindow(): Promise<ActionResult> {
  const admin = await requireAdmin();
  const now = new Date();

  const active = await db.rosterEditWindow.findFirst({
    where: { opensAt: { lte: now }, closesAt: { gt: now } },
    orderBy: { opensAt: "desc" },
  });
  if (!active) return { message: "Nessuna finestra attiva." };

  await db.rosterEditWindow.update({ where: { id: active.id }, data: { closesAt: now } });
  await logAdminAction(Number(admin.id), "CLOSE_ROSTER_WINDOW", "RosterEditWindow", active.id, active, {
    closesAt: now,
  });

  revalidatePath("/admin/modifiche-rosa");
  revalidatePath("/squadra");
  return { message: "Finestra chiusa." };
}
