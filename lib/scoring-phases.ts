import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { computeFantasyTeamPoints } from "@/lib/scoring";
import { resolveMvp } from "@/lib/domain/mvp";
import { MatchStatus } from "@prisma/client";

export type CloseScoringPhaseResult =
  | { ok: true; phaseId: number }
  | { ok: false; error: string };

/**
 * Partite già concluse (nell'intervallo della fase) il cui MVP non è ancora
 * definitivo: finestra di voto aperta o pareggio senza scelta admin.
 * Congelarle ora farebbe perdere per sempre il bonus MVP.
 */
async function findMatchesWithPendingMvp(from: Date | null, to: Date) {
  const matches = await db.match.findMany({
    where: {
      status: MatchStatus.CONCLUDED,
      concludedAt: { ...(from ? { gte: from } : {}), lt: to },
    },
    select: {
      id: true,
      concludedAt: true,
      mvpOverridePlayerId: true,
      votes: { select: { playerId: true } },
      players: { select: { playerId: true } },
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });
  return matches.filter((m) => {
    const res = resolveMvp({
      concludedAt: m.concludedAt,
      votes: m.votes,
      mvpOverridePlayerId: m.mvpOverridePlayerId,
      eligiblePlayerIds: m.players.map((p) => p.playerId),
    });
    return res.status === "open" || res.status === "tied";
  });
}

/**
 * Chiude la fase di punteggio corrente: congela i punti di ogni squadra (rosa
 * attuale) sulle partite concluse dall'ultima chiusura a ora.
 *
 * NB: helper interno (non è una server action). L'autorizzazione admin deve
 * essere garantita dal chiamante (le action wrapper fanno `requireAdmin`).
 */
export async function closeScoringPhase(
  name: string,
  adminUserId: number
): Promise<CloseScoringPhaseResult> {
  const last = await db.scoringPhase.findFirst({
    orderBy: { order: "desc" },
    select: { closedAt: true, order: true },
  });
  const from = last?.closedAt ?? null;
  const to = new Date();

  const pending = await findMatchesWithPendingMvp(from, to);
  if (pending.length > 0) {
    const list = pending
      .map((m) => `${m.homeTeam?.name ?? "TBD"} - ${m.awayTeam?.name ?? "TBD"}`)
      .join(", ");
    return {
      ok: false,
      error: `Impossibile chiudere la fase: l'MVP non è ancora definitivo per ${list} (voto ancora aperto o pareggio da risolvere). Attendi la chiusura del voto o assegna l'MVP manualmente.`,
    };
  }

  const [points, teams] = await Promise.all([
    computeFantasyTeamPoints({ from, to }),
    db.fantasyTeam.findMany({
      select: { id: true, captainPlayerId: true, players: { select: { playerId: true } } },
    }),
  ]);

  const order = (last?.order ?? 0) + 1;

  const phase = await db.$transaction(async (tx) => {
    const created = await tx.scoringPhase.create({
      data: { name, order, startsAt: from, closedAt: to, createdById: adminUserId },
    });
    if (teams.length > 0) {
      await tx.scoringPhaseScore.createMany({
        data: teams.map((t) => ({
          phaseId: created.id,
          fantasyTeamId: t.id,
          points: points.get(t.id) ?? 0,
          rosterPlayerIds: t.players.map((p) => p.playerId),
          captainPlayerId: t.captainPlayerId,
        })),
      });
    }
    return created;
  });

  await logAdminAction(adminUserId, "CLOSE_SCORING_PHASE", "ScoringPhase", phase.id, null, {
    name,
    order,
    closedAt: to,
    teams: teams.length,
  });

  return { ok: true, phaseId: phase.id };
}
