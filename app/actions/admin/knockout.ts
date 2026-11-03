"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { MatchStatus } from "@prisma/client";
import { syncMatchPlayers } from "@/lib/match-players-sync";
import type { ActionResult } from "./football-teams";
import { revalidateDcupPublicPaths } from "./revalidate-public";

// Struttura fissa del bracket (determinata dalla regola del torneo)
const BRACKET_TEMPLATE = [
  // Quarti di finale
  { roundOrder: 1, roundName: "Quarti di finale", bracketPosition: 1, homeSeed: "1A", awaySeed: "2B" },
  { roundOrder: 1, roundName: "Quarti di finale", bracketPosition: 2, homeSeed: "1C", awaySeed: "2D" },
  { roundOrder: 1, roundName: "Quarti di finale", bracketPosition: 3, homeSeed: "2A", awaySeed: "1B" },
  { roundOrder: 1, roundName: "Quarti di finale", bracketPosition: 4, homeSeed: "2C", awaySeed: "1D" },
  // Semifinali
  { roundOrder: 2, roundName: "Semifinale",        bracketPosition: 1, homeSeed: "V QF1", awaySeed: "V QF2" },
  { roundOrder: 2, roundName: "Semifinale",        bracketPosition: 2, homeSeed: "V QF3", awaySeed: "V QF4" },
  // Finale 3°/4°
  { roundOrder: 3, roundName: "Finale 3°/4° posto", bracketPosition: 1, homeSeed: "P SF1", awaySeed: "P SF2" },
  // Finale
  { roundOrder: 4, roundName: "Finale",            bracketPosition: 1, homeSeed: "V SF1", awaySeed: "V SF2" },
];

/** Crea i 4 turni e gli 8 match placeholder in una sola operazione. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function initBracket(_prev: ActionResult | undefined, _formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const existing = await db.knockoutRound.count();
  if (existing > 0) return { message: "Il bracket esiste già. Eliminare i turni prima di reinizializzare." };

  // Crea i turni raggruppando per roundOrder
  const rounds = new Map<number, { name: string; order: number }>();
  for (const t of BRACKET_TEMPLATE) {
    if (!rounds.has(t.roundOrder)) rounds.set(t.roundOrder, { name: t.roundName, order: t.roundOrder });
  }

  for (const [order, { name }] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
    const round = await db.knockoutRound.create({ data: { name, order } });

    const matchesForRound = BRACKET_TEMPLATE.filter((t) => t.roundOrder === order);
    for (const t of matchesForRound) {
      // Placeholder: homeTeamId e awayTeamId vengono impostati a 0 temporaneamente
      // ma usiamo un team fittizio — in realtà non possiamo creare match senza team.
      // Usiamo il primo team disponibile come placeholder e poi l'admin assegna.
      // Alternativa: creare match "TBD" con seed only — ma lo schema richiede homeTeamId.
      // SOLUZIONE: creiamo il match con homeTeamId=awayTeamId=0 NON VALIDO.
      // Quindi creiamo i match senza team (homeTeamId/awayTeamId vengono assegnati dopo).
      // Per farlo: prendiamo il primo team disponibile come "placeholder" temporaneo.
      await db.match.create({
        data: {
          knockoutRoundId: round.id,
          homeSeed: t.homeSeed,
          awaySeed: t.awaySeed,
          bracketPosition: t.bracketPosition,
          status: MatchStatus.DRAFT,
          startsAt: new Date(0), // placeholder, aggiornato quando l'admin fissa la data
          homeTeamId: null,      // TBD — assegnato da assignKnockoutTeams
          awayTeamId: null,
        },
      });
    }

    await logAdminAction(Number(admin.id), "INIT_BRACKET_ROUND", "KnockoutRound", round.id, null, { name, order });
  }

  revalidatePath("/admin/eliminazione");
  revalidatePath("/eliminazione");
  await revalidateDcupPublicPaths();
  return {};
}

function parsePositiveId(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function assignKnockoutTeams(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const matchId = parsePositiveId(formData.get("matchId"));
  const homeTeamId = parsePositiveId(formData.get("homeTeamId"));
  const awayTeamId = parsePositiveId(formData.get("awayTeamId"));

  if (!matchId) return { message: "Partita non valida." };
  if (!homeTeamId || !awayTeamId) return { message: "Seleziona entrambe le squadre." };
  if (homeTeamId === awayTeamId) return { message: "Le due squadre devono essere diverse." };

  const before = await db.match.findUnique({
    where: { id: matchId },
    select: {
      homeTeamId: true,
      awayTeamId: true,
      knockoutRoundId: true,
      status: true,
      _count: { select: { goals: true, bonuses: true } },
    },
  });
  if (!before) return { message: "Partita non trovata." };
  if (before.knockoutRoundId === null) {
    return { message: "La partita non appartiene alla fase a eliminazione diretta." };
  }
  if (before.status === MatchStatus.CONCLUDED) {
    return { message: "Non puoi cambiare le squadre di una partita conclusa." };
  }
  if (before._count.goals > 0 || before._count.bonuses > 0) {
    return { message: "Non puoi cambiare le squadre di una partita con goal o bonus registrati: eliminali prima." };
  }

  const teams = await db.footballTeam.findMany({
    where: { id: { in: [homeTeamId, awayTeamId] } },
    select: { id: true },
  });
  if (teams.length !== 2) return { message: "Una o entrambe le squadre non esistono." };

  const conflict = await db.match.findFirst({
    where: {
      knockoutRoundId: before.knockoutRoundId,
      id: { not: matchId },
      OR: [
        { homeTeamId: { in: [homeTeamId, awayTeamId] } },
        { awayTeamId: { in: [homeTeamId, awayTeamId] } },
      ],
    },
    select: { id: true },
  });
  if (conflict) {
    return { message: "Una delle squadre è già assegnata a un'altra partita dello stesso turno." };
  }

  const { playerCount } = await db.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: matchId },
      data: { homeTeamId, awayTeamId },
    });
    return syncMatchPlayers(tx, matchId);
  });
  await logAdminAction(
    Number(admin.id),
    "ASSIGN_KNOCKOUT_TEAMS",
    "Match",
    matchId,
    { homeTeamId: before.homeTeamId, awayTeamId: before.awayTeamId },
    { homeTeamId, awayTeamId, autoAddedPlayers: playerCount }
  );

  revalidatePath("/admin/eliminazione");
  revalidatePath(`/admin/partite/${matchId}`);
  revalidatePath("/eliminazione");
  await revalidateDcupPublicPaths(matchId);
  return {};
}

export async function updateKnockoutRound(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = parsePositiveId(formData.get("id"));
  if (!id) return { message: "Turno non valido." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { message: "Nome obbligatorio." };

  const before = await db.knockoutRound.findUnique({ where: { id } });
  if (!before) return { message: "Turno non trovato." };
  const round = await db.knockoutRound.update({ where: { id }, data: { name } });
  await logAdminAction(Number(admin.id), "UPDATE", "KnockoutRound", id, before, round);

  revalidatePath("/admin/eliminazione");
  await revalidateDcupPublicPaths();
  return {};
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteBracket(_prev: ActionResult | undefined, _formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const rounds = await db.knockoutRound.findMany({ orderBy: { order: "asc" } });
  if (rounds.length === 0) return { message: "Nessun bracket da eliminare." };

  const knockoutMatches = await db.match.findMany({
    where: { knockoutRoundId: { not: null } },
    select: {
      id: true,
      knockoutRoundId: true,
      homeTeamId: true,
      awayTeamId: true,
      homeSeed: true,
      awaySeed: true,
      bracketPosition: true,
      status: true,
      startsAt: true,
      _count: { select: { goals: true, bonuses: true, votes: true } },
    },
  });

  const blocked = knockoutMatches.some(
    (m) =>
      m.homeTeamId !== null ||
      m.awayTeamId !== null ||
      m._count.goals > 0 ||
      m._count.bonuses > 0 ||
      m._count.votes > 0
  );
  if (blocked) {
    return {
      message:
        "Impossibile eliminare il bracket: alcune partite hanno squadre assegnate, goal, bonus o voti. Elimina prima goal, bonus e voti, poi elimina quelle partite dalla sezione Partite.",
    };
  }

  const matchIds = knockoutMatches.map((m) => m.id);
  const roundIds = rounds.map((r) => r.id);
  await db.$transaction([
    db.match.deleteMany({ where: { id: { in: matchIds } } }),
    db.knockoutRound.deleteMany({ where: { id: { in: roundIds } } }),
  ]);
  await logAdminAction(
    Number(admin.id),
    "DELETE_BRACKET",
    "KnockoutRound",
    0,
    {
      rounds,
      matches: knockoutMatches.map(({ _count, startsAt, ...m }) => ({
        ...m,
        startsAt: startsAt.toISOString(),
      })),
    },
    null
  );

  revalidatePath("/admin/eliminazione");
  revalidatePath("/eliminazione");
  await revalidateDcupPublicPaths();
  return {};
}
