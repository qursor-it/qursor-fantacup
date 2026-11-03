"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { syncMatchPlayers } from "@/lib/match-players-sync";
import type { ActionResult } from "./football-teams";
import { revalidateDcupPublicPaths } from "./revalidate-public";

function isPositiveId(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

export async function addMatchPlayer(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const playerId = Number(formData.get("playerId"));
  if (!isPositiveId(matchId)) return { message: "Partita non valida." };
  if (!isPositiveId(playerId)) return { message: "Seleziona un giocatore." };

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true },
  });
  if (!match) return { message: "Partita non trovata." };

  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return { message: "Giocatore non trovato." };

  if (player.footballTeamId !== match.homeTeamId && player.footballTeamId !== match.awayTeamId) {
    return { message: "Il giocatore non appartiene a nessuna delle due squadre." };
  }

  await db.matchPlayer.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId },
    update: {},
  });

  await logAdminAction(Number(admin.id), "ADD_PLAYER", "MatchPlayer", `${matchId}_${playerId}`, null, { matchId, playerId });
  revalidatePath(`/admin/partite/${matchId}`);
  await revalidateDcupPublicPaths(matchId);
  return {};
}

export async function addAllMatchPlayers(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  if (!isPositiveId(matchId)) return { message: "Partita non valida." };

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { homeTeamId: true, awayTeamId: true },
  });
  if (!match) return { message: "Partita non trovata." };

  const { playerCount } = await db.$transaction((tx) => syncMatchPlayers(tx, matchId));

  await logAdminAction(Number(admin.id), "ADD_PLAYER", "MatchPlayer", `${matchId}_all`, null, {
    matchId,
    count: playerCount,
  });
  revalidatePath(`/admin/partite/${matchId}`);
  await revalidateDcupPublicPaths(matchId);
  return {};
}

export async function removeMatchPlayer(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const playerId = Number(formData.get("playerId"));
  if (!isPositiveId(matchId) || !isPositiveId(playerId)) return { message: "Dati non validi." };

  await db.matchPlayer.deleteMany({ where: { matchId, playerId } });
  await logAdminAction(Number(admin.id), "REMOVE_PLAYER", "MatchPlayer", `${matchId}_${playerId}`, { matchId, playerId }, null);

  revalidatePath(`/admin/partite/${matchId}`);
  await revalidateDcupPublicPaths(matchId);
  return {};
}
