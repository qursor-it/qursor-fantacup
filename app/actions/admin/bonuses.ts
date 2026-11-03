"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import type { ActionResult } from "./football-teams";
import { revalidateBonusPublicPaths, revalidateDcupPublicPaths } from "./revalidate-public";

const MAX_BONUS_QUANTITY = 20;
/** PlayerMatchBonus.points è Decimal(5, 2): |valore| massimo 999.99. */
const MAX_STORED_POINTS = 999.99;

const Schema = z.object({
  matchId: z.coerce.number().int().positive(),
  playerId: z.coerce.number().int().positive(),
  bonusTypeId: z.coerce.number().int().positive("Tipo bonus obbligatorio"),
  quantity: z.coerce
    .number({ error: "Quantità non valida" })
    .int("La quantità deve essere un numero intero")
    .min(1, "Quantità minima 1")
    .max(MAX_BONUS_QUANTITY, `Quantità massima ${MAX_BONUS_QUANTITY}`)
    .default(1),
});

export async function assignBonus(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = Schema.safeParse({
    matchId: formData.get("matchId"),
    playerId: formData.get("playerId"),
    bonusTypeId: formData.get("bonusTypeId"),
    quantity: formData.get("quantity") || 1,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const bonusType = await db.bonusType.findUnique({ where: { id: parsed.data.bonusTypeId } });
  if (!bonusType) return { message: "Tipo bonus non trovato." };

  const totalPoints = Number(bonusType.points) * parsed.data.quantity;
  if (!Number.isFinite(totalPoints) || Math.abs(totalPoints) > MAX_STORED_POINTS) {
    return { message: `Punteggio totale fuori limite (max ±${MAX_STORED_POINTS}): riduci la quantità.` };
  }

  // Verifica che il giocatore sia presente nella partita
  const mp = await db.matchPlayer.findUnique({
    where: { matchId_playerId: { matchId: parsed.data.matchId, playerId: parsed.data.playerId } },
  });
  if (!mp) return { message: "Il giocatore non è presente in questa partita." };

  const bonus = await db.playerMatchBonus.create({
    data: {
      matchId: parsed.data.matchId,
      playerId: parsed.data.playerId,
      bonusTypeId: parsed.data.bonusTypeId,
      points: totalPoints,
      quantity: parsed.data.quantity,
    },
  });
  await logAdminAction(Number(admin.id), "ASSIGN_BONUS", "PlayerMatchBonus", bonus.id, null, bonus);

  revalidatePath(`/admin/partite/${parsed.data.matchId}`);
  await revalidateDcupPublicPaths(parsed.data.matchId);
  revalidateBonusPublicPaths();
  return {};
}

export async function deleteBonus(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Bonus non valido." };

  const before = await db.playerMatchBonus.findUnique({ where: { id } });
  if (!before) return { message: "Bonus non trovato." };
  const matchId = before.matchId;

  await db.playerMatchBonus.delete({ where: { id } });
  await logAdminAction(Number(admin.id), "DELETE_BONUS", "PlayerMatchBonus", id, before, null);

  revalidatePath(`/admin/partite/${matchId}`);
  await revalidateDcupPublicPaths(matchId);
  revalidateBonusPublicPaths();
  return {};
}
