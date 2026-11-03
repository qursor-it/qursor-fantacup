"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { PlayerRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { validateRoster } from "@/lib/domain/roster";
import { fantasyTeamNameSchema } from "@/lib/domain/fantasy-team";
import { getActiveEditWindow } from "@/lib/roster-edit-window";
import { countSubstitutions } from "@/lib/domain/roster-edit-window";
import { PUBLIC_CACHE_TAGS } from "@/lib/data/public/cache";
import { invalidateFantasyRankingSnapshot } from "@/lib/fantasy-ranking-snapshot";

export type CreateTeamResult =
  | { success: true; teamId: number }
  | { success: false; errors?: Record<string, string[]>; message?: string };

const Schema = z.object({
  name: fantasyTeamNameSchema,
  captainPlayerId: z.coerce.number().int().positive("Capitano obbligatorio"),
  playerIds: z
    .array(z.coerce.number().int().positive())
    .length(5, "Seleziona esattamente 5 giocatori"),
});

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const ROSTER_ERROR_MESSAGES: Record<string, string> = {
  WRONG_SIZE: "Seleziona esattamente 5 giocatori.",
  WRONG_GK_COUNT: "Devi avere esattamente 1 portiere.",
  WRONG_PLAYER_COUNT: "Devi avere esattamente 4 giocatori di movimento.",
  DUPLICATE_TEAM: "I 5 giocatori devono appartenere a 5 squadre reali diverse.",
  CAPTAIN_NOT_IN_ROSTER: "Il capitano deve essere uno dei 5 giocatori selezionati.",
};

async function updateFantasyPublicCache() {
  updateTag(PUBLIC_CACHE_TAGS.fantasy);
  updateTag(PUBLIC_CACHE_TAGS.fantasyPicks);
  updateTag(PUBLIC_CACHE_TAGS.fantasyRankings);
  await invalidateFantasyRankingSnapshot();
}

export async function createFantasyTeam(
  _prev: CreateTeamResult | undefined,
  formData: FormData
): Promise<CreateTeamResult> {
  const user = await requireAuth();
  const userId = Number(user.id);

  // Check user doesn't already have a team
  const existing = await db.fantasyTeam.findUnique({ where: { userId } });
  if (existing) {
    return { success: false, message: "Hai già una squadra fantasy." };
  }

  const rawPlayerIds = formData.getAll("playerIds").map(Number);
  const parsed = Schema.safeParse({
    name: formData.get("name"),
    captainPlayerId: formData.get("captainPlayerId"),
    playerIds: rawPlayerIds,
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { name, captainPlayerId, playerIds } = parsed.data;

  const players = await db.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, role: true, footballTeamId: true },
  });

  if (players.length !== 5) {
    return { success: false, message: "Uno o più giocatori non trovati." };
  }

  const rosterError = validateRoster(
    players.map((p) => ({ playerId: p.id, role: p.role as PlayerRole, footballTeamId: p.footballTeamId })),
    captainPlayerId
  );

  if (rosterError) {
    return { success: false, message: ROSTER_ERROR_MESSAGES[rosterError] ?? rosterError };
  }

  let newTeam: { id: number };
  try {
    newTeam = await db.fantasyTeam.create({
      data: {
        name,
        userId,
        captainPlayerId,
        players: {
          create: playerIds.map((playerId) => ({ playerId })),
        },
      },
      select: { id: true },
    });
  } catch (e) {
    // Doppio submit concorrente: il vincolo unique su userId protegge il DB.
    if (isUniqueViolation(e)) {
      return { success: false, message: "Hai già una squadra fantasy." };
    }
    throw e;
  }

  revalidatePath("/dashboard");
  revalidatePath("/squadra");
  await updateFantasyPublicCache();
  return { success: true, teamId: newTeam.id };
}

export type UpdateRosterResult =
  | { success: true }
  | { success: false; errors?: Record<string, string[]>; message?: string };

const UpdateSchema = z.object({
  captainPlayerId: z.coerce.number().int().positive("Capitano obbligatorio"),
  playerIds: z
    .array(z.coerce.number().int().positive())
    .length(5, "Seleziona esattamente 5 giocatori"),
});

/**
 * Modifica della rosa da parte dell'utente, consentita solo durante una finestra
 * di "mercato" aperta dall'admin e nei limiti di sostituzioni configurati.
 * Il nome squadra non è modificabile; il cambio di capitano è sempre libero.
 */
export async function updateMyFantasyRoster(
  _prev: UpdateRosterResult | undefined,
  formData: FormData
): Promise<UpdateRosterResult> {
  const user = await requireAuth();
  const userId = Number(user.id);

  const team = await db.fantasyTeam.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!team) return { success: false, message: "Non hai ancora una squadra." };

  const window = await getActiveEditWindow();
  if (!window) return { success: false, message: "Le modifiche non sono aperte." };

  const rawPlayerIds = formData.getAll("playerIds").map(Number);
  const parsed = UpdateSchema.safeParse({
    captainPlayerId: formData.get("captainPlayerId"),
    playerIds: rawPlayerIds,
  });
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const { captainPlayerId, playerIds } = parsed.data;

  const players = await db.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, role: true, footballTeamId: true },
  });
  if (players.length !== 5) {
    return { success: false, message: "Uno o più giocatori non trovati." };
  }

  const rosterError = validateRoster(
    players.map((p) => ({ playerId: p.id, role: p.role as PlayerRole, footballTeamId: p.footballTeamId })),
    captainPlayerId
  );
  if (rosterError) {
    return { success: false, message: ROSTER_ERROR_MESSAGES[rosterError] ?? rosterError };
  }

  // Transazione interattiva con lock sulla riga FantasyTeam: due salvataggi
  // concorrenti vengono serializzati e il secondo rilegge rosa/uso/baseline
  // aggiornati prima di validare il budget di cambi.
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "FantasyTeam" WHERE id = ${team.id} FOR UPDATE`;

    const now = new Date();
    const activeWindow = await tx.rosterEditWindow.findFirst({
      where: { opensAt: { lte: now }, closesAt: { gt: now } },
      orderBy: { opensAt: "desc" },
    });
    if (!activeWindow) {
      return { success: false as const, message: "Le modifiche non sono aperte." };
    }

    const currentRoster = await tx.fantasyTeamPlayer.findMany({
      where: { fantasyTeamId: team.id },
      select: { playerId: true },
    });

    // Baseline = rosa al primo salvataggio in questa finestra (rosa di partenza).
    const usage = await tx.rosterEditUsage.findUnique({
      where: { windowId_fantasyTeamId: { windowId: activeWindow.id, fantasyTeamId: team.id } },
    });
    const baseline = usage
      ? (usage.baselinePlayerIds as number[])
      : currentRoster.map((p) => p.playerId);

    const changesUsed = countSubstitutions(baseline, playerIds);
    if (changesUsed > activeWindow.maxChanges) {
      return {
        success: false as const,
        message: `Puoi sostituire al massimo ${activeWindow.maxChanges} ${
          activeWindow.maxChanges === 1 ? "giocatore" : "giocatori"
        } rispetto alla rosa di partenza.`,
      };
    }

    await tx.rosterEditUsage.upsert({
      where: { windowId_fantasyTeamId: { windowId: activeWindow.id, fantasyTeamId: team.id } },
      create: {
        windowId: activeWindow.id,
        fantasyTeamId: team.id,
        baselinePlayerIds: baseline,
        changesUsed,
      },
      update: { changesUsed },
    });
    await tx.fantasyTeamPlayer.deleteMany({ where: { fantasyTeamId: team.id } });
    await tx.fantasyTeamPlayer.createMany({
      data: playerIds.map((playerId) => ({ fantasyTeamId: team.id, playerId })),
    });
    await tx.fantasyTeam.update({ where: { id: team.id }, data: { captainPlayerId } });

    return { success: true as const };
  });

  if (!outcome.success) return outcome;

  revalidatePath("/squadra");
  revalidatePath("/dashboard");
  await updateFantasyPublicCache();
  return { success: true };
}
