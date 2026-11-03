"use server";

import { revalidatePath } from "next/cache";
import { MatchStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { computeScoreFromGoals } from "@/lib/domain/goals";
import type { ActionResult } from "./football-teams";
import { revalidateDcupPublicPaths } from "./revalidate-public";

async function syncMatchScore(tx: Prisma.TransactionClient, matchId: number) {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    select: { homeTeamId: true, awayTeamId: true, status: true },
  });
  if (!match) return;

  const goals = await tx.matchGoal.findMany({
    where: { matchId },
    include: { scorer: { select: { footballTeamId: true } } },
  });

  if (goals.length === 0) {
    const matchStarted =
      match.status === MatchStatus.LIVE || match.status === MatchStatus.CONCLUDED;
    await tx.match.update({
      where: { id: matchId },
      data: matchStarted
        ? { homeScore: 0, awayScore: 0 }
        : { homeScore: null, awayScore: null },
    });
    return;
  }

  if (match.homeTeamId === null || match.awayTeamId === null) return;

  const { homeScore, awayScore } = computeScoreFromGoals(
    goals,
    match.homeTeamId,
    match.awayTeamId
  );
  await tx.match.update({ where: { id: matchId }, data: { homeScore, awayScore } });
}

const AddGoalSchema = z.object({
  matchId:   z.coerce.number().int().positive(),
  scorerId:  z.coerce.number().int().positive("Seleziona il marcatore"),
  isOwnGoal: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
});

export async function addGoal(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = AddGoalSchema.safeParse({
    matchId:   formData.get("matchId"),
    scorerId:  formData.get("scorerId"),
    isOwnGoal: formData.get("isOwnGoal"),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const match = await db.match.findUnique({
    where: { id: parsed.data.matchId },
    select: { homeTeamId: true, awayTeamId: true, status: true },
  });
  if (!match) return { message: "Partita non trovata." };
  if (match.status !== MatchStatus.LIVE && match.status !== MatchStatus.CONCLUDED) {
    return { message: "Puoi registrare i gol solo per partite in corso o concluse." };
  }
  if (match.homeTeamId === null || match.awayTeamId === null) {
    return { message: "Assegna entrambe le squadre prima di inserire i goal." };
  }

  const scorer = await db.player.findUnique({
    where: { id: parsed.data.scorerId },
    select: { footballTeamId: true },
  });
  if (!scorer) return { message: "Giocatore non trovato." };
  if (scorer.footballTeamId !== match.homeTeamId && scorer.footballTeamId !== match.awayTeamId) {
    return { message: "Il marcatore non appartiene a nessuna delle due squadre della partita." };
  }

  const goal = await db.$transaction(async (tx) => {
    const created = await tx.matchGoal.create({
      data: {
        matchId:   parsed.data.matchId,
        scorerId:  parsed.data.scorerId,
        isOwnGoal: parsed.data.isOwnGoal,
      },
    });
    await syncMatchScore(tx, parsed.data.matchId);
    return created;
  });
  await logAdminAction(Number(admin.id), "ADD_GOAL", "MatchGoal", goal.id, null, goal);

  revalidatePath(`/admin/partite/${parsed.data.matchId}`);
  await revalidateDcupPublicPaths(parsed.data.matchId);
  return {};
}

export async function deleteGoal(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Goal non valido." };

  const before = await db.matchGoal.findUnique({ where: { id } });
  if (!before) return { message: "Goal non trovato." };
  const matchId = before.matchId;

  await db.$transaction(async (tx) => {
    await tx.matchGoal.delete({ where: { id } });
    await syncMatchScore(tx, matchId);
  });
  await logAdminAction(Number(admin.id), "DELETE_GOAL", "MatchGoal", id, before, null);

  revalidatePath(`/admin/partite/${matchId}`);
  await revalidateDcupPublicPaths(matchId);
  return {};
}
