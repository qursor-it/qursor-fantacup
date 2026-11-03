"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { parseMatchDateTimeInput } from "@/lib/domain/match";
import { getLastClosedAt } from "@/lib/scoring";
import type { ActionResult } from "./football-teams";
import { revalidateDcupPublicPaths } from "./revalidate-public";

const scoreField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().min(0).max(99).nullable()
);

const Schema = z.object({
  homeTeamId: z.coerce.number().int().positive("Squadra casa obbligatoria"),
  awayTeamId: z.coerce.number().int().positive("Squadra ospite obbligatoria"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida").or(z.literal("")),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Ora non valida").or(z.literal("")),
  status: z.nativeEnum(MatchStatus).optional(),
  homeScore: scoreField.optional(),
  awayScore: scoreField.optional(),
  groupId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().positive().nullable()).optional(),
  knockoutRoundId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().positive().nullable()).optional(),
});

const CreateSchema = z.object({
  homeTeamId: z.coerce.number().int().positive("Squadra casa obbligatoria"),
  awayTeamId: z.coerce.number().int().positive("Squadra ospite obbligatoria"),
  status: z.nativeEnum(MatchStatus).default(MatchStatus.DRAFT),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida").or(z.literal("")).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Ora non valida").or(z.literal("")).optional(),
  groupId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().positive().nullable()).optional(),
  knockoutRoundId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().positive().nullable()).optional(),
});

function startsAtFromForm(date: string | undefined, time: string | undefined) {
  if (date && time) {
    return parseMatchDateTimeInput(date, time);
  }

  const startsAt = new Date();
  startsAt.setSeconds(0, 0);
  return startsAt;
}

const onlyOnePhase = (d: { groupId?: number | null; knockoutRoundId?: number | null }) =>
  !(d.groupId && d.knockoutRoundId);
const ONLY_ONE_PHASE_MSG = "Una partita può appartenere a un girone oppure a un turno a eliminazione diretta, non a entrambi.";

/** Transizioni di stato ammesse dai pulsanti di stato. */
const ALLOWED_TRANSITIONS: Record<MatchStatus, MatchStatus[]> = {
  DRAFT: [MatchStatus.SCHEDULED],
  SCHEDULED: [MatchStatus.DRAFT, MatchStatus.LIVE, MatchStatus.CONCLUDED],
  LIVE: [MatchStatus.SCHEDULED, MatchStatus.CONCLUDED],
  CONCLUDED: [MatchStatus.SCHEDULED],
};

function isValidId(id: number) {
  return Number.isInteger(id) && id > 0;
}

/** Requisiti minimi per concludere una partita. */
function cannotConcludeReason(m: {
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
}): string | null {
  if (!m.homeTeamId || !m.awayTeamId) return "Assegna entrambe le squadre prima di concludere la partita.";
  if (m.homeScore === null || m.awayScore === null) {
    return "Inserisci il risultato (anche 0-0) prima di concludere la partita.";
  }
  return null;
}

/**
 * Una partita già congelata in una fase di punteggio chiusa non può tornare
 * indietro: riconcludendola verrebbe contata anche nella fase in corso.
 */
async function frozenPhaseReason(concludedAt: Date | null): Promise<string | null> {
  if (!concludedAt) return null;
  const lastClosedAt = await getLastClosedAt();
  if (lastClosedAt && concludedAt < lastClosedAt) {
    return "Questa partita fa parte di una fase di punteggio già chiusa: non può essere riaperta. Correggi direttamente gol e bonus (lo storico congelato resta invariato).";
  }
  return null;
}

export async function createMatch(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = CreateSchema.safeParse({
    homeTeamId: formData.get("homeTeamId"),
    awayTeamId: formData.get("awayTeamId"),
    status: formData.get("status") || MatchStatus.DRAFT,
    date: formData.get("date") || undefined,
    time: formData.get("time") || undefined,
    groupId: formData.get("groupId") || null,
    knockoutRoundId: formData.get("knockoutRoundId") || null,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  if (parsed.data.homeTeamId === parsed.data.awayTeamId) {
    return { errors: { awayTeamId: ["La squadra ospite deve essere diversa dalla squadra di casa."] } };
  }

  if ((parsed.data.date && !parsed.data.time) || (!parsed.data.date && parsed.data.time)) {
    return { errors: { date: ["Inserisci sia data sia ora."] } };
  }
  if (!onlyOnePhase(parsed.data)) return { message: ONLY_ONE_PHASE_MSG };
  if (parsed.data.status === MatchStatus.CONCLUDED || parsed.data.status === MatchStatus.LIVE) {
    return { message: "Una nuova partita può essere creata solo come bozza o programmata." };
  }

  if (parsed.data.knockoutRoundId) {
    // Il bracket è creato per intero da initBracket(): non deve mai ricevere
    // partite aggiuntive da qui, altrimenti si duplica una casella del tabellone.
    const existing = await db.match.findFirst({ where: { knockoutRoundId: parsed.data.knockoutRoundId } });
    if (existing) {
      return { message: "Questo turno di eliminazione diretta ha già le sue partite: usa \"Eliminazione diretta\" per assegnare le squadre, non creare una nuova partita qui." };
    }
  }

  const startsAt = startsAtFromForm(parsed.data.date, parsed.data.time);

  const match = await db.match.create({
    data: {
      homeTeamId: parsed.data.homeTeamId,
      awayTeamId: parsed.data.awayTeamId,
      status: parsed.data.status,
      startsAt,
      groupId: parsed.data.groupId ?? null,
      knockoutRoundId: parsed.data.knockoutRoundId ?? null,
    },
  });

  const players = await db.player.findMany({
    where: { footballTeamId: { in: [parsed.data.homeTeamId, parsed.data.awayTeamId] } },
    select: { id: true },
  });
  if (players.length > 0) {
    await db.matchPlayer.createMany({
      data: players.map((p) => ({ matchId: match.id, playerId: p.id })),
      skipDuplicates: true,
    });
  }

  await logAdminAction(Number(admin.id), "CREATE", "Match", match.id, null, {
    ...match,
    startsAt: match.startsAt.toISOString(),
    autoAddedPlayers: players.length,
  });

  revalidatePath("/admin/partite");
  await revalidateDcupPublicPaths(match.id);
  redirect("/admin/partite");
}

export async function updateMatch(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  const parsed = Schema.safeParse({
    homeTeamId: formData.get("homeTeamId"),
    awayTeamId: formData.get("awayTeamId"),
    date: formData.get("date"),
    time: formData.get("time"),
    status: formData.get("status") || undefined,
    homeScore: formData.get("homeScore"),
    awayScore: formData.get("awayScore"),
    groupId: formData.get("groupId") || null,
    knockoutRoundId: formData.get("knockoutRoundId") || null,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  if (parsed.data.homeTeamId === parsed.data.awayTeamId) {
    return { errors: { awayTeamId: ["Le due squadre devono essere diverse."] } };
  }

  if (!isValidId(id)) return { message: "Partita non valida." };
  if (!onlyOnePhase(parsed.data)) return { message: ONLY_ONE_PHASE_MSG };

  const before = await db.match.findUnique({
    where: { id },
    include: { _count: { select: { goals: true, votes: true, bonuses: true } } },
  });
  if (!before) return { message: "Partita non trovata." };

  const teamsChanged =
    before.homeTeamId !== parsed.data.homeTeamId || before.awayTeamId !== parsed.data.awayTeamId;
  if (teamsChanged && (before._count.goals > 0 || before._count.votes > 0 || before._count.bonuses > 0)) {
    return { message: "Non puoi cambiare le squadre: la partita ha già gol, voti o bonus registrati. Eliminali prima." };
  }

  const nextHomeScore = parsed.data.homeScore ?? null;
  const nextAwayScore = parsed.data.awayScore ?? null;
  if (
    before._count.goals > 0 &&
    (nextHomeScore !== before.homeScore || nextAwayScore !== before.awayScore)
  ) {
    return { message: "Il risultato è calcolato dai marcatori registrati: modifica i gol invece del punteggio." };
  }

  if (parsed.data.knockoutRoundId && parsed.data.knockoutRoundId !== before.knockoutRoundId) {
    return { message: "Le partite a eliminazione diretta si gestiscono dal tabellone: non puoi spostare qui una partita in un turno." };
  }

  const nextStatus = parsed.data.status ?? before.status;
  if (nextStatus === MatchStatus.CONCLUDED) {
    const reason = cannotConcludeReason({
      homeTeamId: parsed.data.homeTeamId,
      awayTeamId: parsed.data.awayTeamId,
      homeScore: nextHomeScore,
      awayScore: nextAwayScore,
    });
    if (reason) return { message: reason };
  }
  if (before.status === MatchStatus.CONCLUDED && nextStatus !== MatchStatus.CONCLUDED) {
    const reason = await frozenPhaseReason(before.concludedAt);
    if (reason) return { message: reason };
  }

  const updateData: Parameters<typeof db.match.update>[0]["data"] = {
    homeTeamId: parsed.data.homeTeamId,
    awayTeamId: parsed.data.awayTeamId,
    startsAt: parseMatchDateTimeInput(parsed.data.date, parsed.data.time),
    homeScore: parsed.data.homeScore ?? null,
    awayScore: parsed.data.awayScore ?? null,
    groupId: parsed.data.groupId ?? null,
    knockoutRoundId: parsed.data.knockoutRoundId ?? null,
  };

  if (parsed.data.status) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === MatchStatus.CONCLUDED) {
      if (before.status !== MatchStatus.CONCLUDED || !before.concludedAt) {
        updateData.concludedAt = new Date();
      }
    } else {
      updateData.concludedAt = null;
      updateData.mvpOverridePlayerId = null;
    }
  }

  const match = await db.$transaction(async (tx) => {
    const updated = await tx.match.update({ where: { id }, data: updateData });
    if (teamsChanged) {
      // Riallinea i giocatori presenti alle nuove squadre (nessun gol/voto/bonus esistente, verificato sopra).
      await tx.matchPlayer.deleteMany({ where: { matchId: id } });
      const players = await tx.player.findMany({
        where: { footballTeamId: { in: [parsed.data.homeTeamId, parsed.data.awayTeamId] } },
        select: { id: true },
      });
      if (players.length > 0) {
        await tx.matchPlayer.createMany({
          data: players.map((p) => ({ matchId: id, playerId: p.id })),
          skipDuplicates: true,
        });
      }
    }
    return updated;
  });
  await logAdminAction(Number(admin.id), "UPDATE", "Match", id,
    { ...before, startsAt: before.startsAt.toISOString() },
    { ...match, startsAt: match.startsAt.toISOString() }
  );

  revalidatePath("/admin/partite");
  revalidatePath(`/admin/partite/${id}`);
  await revalidateDcupPublicPaths(id);
  redirect(`/admin/partite/${id}`);
}

export async function advanceMatchStatus(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("matchId"));
  const newStatus = formData.get("newStatus") as MatchStatus;

  if (!Object.values(MatchStatus).includes(newStatus)) {
    return { message: "Stato non valido." };
  }

  if (!isValidId(id)) return { message: "Partita non valida." };

  const match = await db.match.findUnique({
    where: { id },
    include: { _count: { select: { players: true } } },
  });
  if (!match) return { message: "Partita non trovata." };
  if (match.status === newStatus) return {};

  if (!ALLOWED_TRANSITIONS[match.status].includes(newStatus)) {
    return { message: `Passaggio di stato non consentito (${match.status} → ${newStatus}).` };
  }
  if (newStatus === MatchStatus.CONCLUDED) {
    const reason = cannotConcludeReason(match);
    if (reason) return { message: reason };
  }
  if (match.status === MatchStatus.CONCLUDED) {
    const reason = await frozenPhaseReason(match.concludedAt);
    if (reason) return { message: reason };
  }

  const updateData: Parameters<typeof db.match.update>[0]["data"] = {
    status: newStatus,
    concludedAt: newStatus === MatchStatus.CONCLUDED ? new Date() : null,
  };
  if (newStatus !== MatchStatus.CONCLUDED) {
    updateData.mvpOverridePlayerId = null;
  }

  await db.match.update({ where: { id }, data: updateData });
  await logAdminAction(
    Number(admin.id),
    "UPDATE",
    "Match",
    id,
    { status: match.status, concludedAt: match.concludedAt, mvpOverridePlayerId: match.mvpOverridePlayerId },
    {
      status: newStatus,
      concludedAt: updateData.concludedAt ?? null,
      mvpOverridePlayerId: newStatus === MatchStatus.CONCLUDED ? match.mvpOverridePlayerId : null,
    }
  );

  revalidatePath(`/admin/partite/${id}`);
  revalidatePath("/admin/partite");
  await revalidateDcupPublicPaths(id);
  return {};
}

export async function updateMatchMvpOverride(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const matchId = Number(formData.get("matchId"));
  const rawPlayerId = formData.get("playerId");
  const playerId = rawPlayerId === "" || rawPlayerId === null ? null : Number(rawPlayerId);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return { message: "Partita non valida." };
  }
  if (playerId !== null && (!Number.isInteger(playerId) || playerId <= 0)) {
    return { message: "MVP non valido." };
  }

  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      mvpOverridePlayerId: true,
      players: { select: { playerId: true } },
    },
  });
  if (!match) return { message: "Partita non trovata." };
  if (match.status !== MatchStatus.CONCLUDED) {
    return { message: "Puoi impostare l'MVP solo per partite concluse." };
  }

  if (playerId !== null && !match.players.some((player) => player.playerId === playerId)) {
    return { message: "Il giocatore scelto non è presente in questa partita." };
  }

  const updated = await db.match.update({
    where: { id: matchId },
    data: { mvpOverridePlayerId: playerId },
    select: { id: true, mvpOverridePlayerId: true },
  });

  await logAdminAction(
    Number(admin.id),
    "UPDATE_MVP_OVERRIDE",
    "Match",
    matchId,
    { mvpOverridePlayerId: match.mvpOverridePlayerId },
    { mvpOverridePlayerId: updated.mvpOverridePlayerId }
  );

  revalidatePath(`/admin/partite/${matchId}`);
  revalidatePath(`/partite/${matchId}`);
  revalidatePath("/classifica-fanta");
  revalidatePath("/dashboard");
  await revalidateDcupPublicPaths(matchId);
  return {};
}

export async function updateMatchScore(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("matchId"));
  const rawHome = formData.get("homeScore");
  const rawAway = formData.get("awayScore");

  const homeScore = rawHome === "" || rawHome === null ? null : Number(rawHome);
  const awayScore = rawAway === "" || rawAway === null ? null : Number(rawAway);

  if (homeScore !== null && (!Number.isInteger(homeScore) || homeScore < 0 || homeScore > 99))
    return { message: "Risultato casa non valido." };
  if (awayScore !== null && (!Number.isInteger(awayScore) || awayScore < 0 || awayScore > 99))
    return { message: "Risultato ospite non valido." };

  if (!isValidId(id)) return { message: "Partita non valida." };
  const before = await db.match.findUnique({
    where: { id },
    select: { homeScore: true, awayScore: true, status: true, _count: { select: { goals: true } } },
  });
  if (!before) return { message: "Partita non trovata." };
  if (before._count.goals > 0) {
    return { message: "Il risultato è calcolato dai marcatori registrati: modifica i gol invece del punteggio." };
  }
  if (before.status === MatchStatus.CONCLUDED && (homeScore === null || awayScore === null)) {
    return { message: "Una partita conclusa deve avere un risultato." };
  }

  await db.match.update({ where: { id }, data: { homeScore, awayScore } });
  await logAdminAction(Number(admin.id), "UPDATE_SCORE", "Match", id,
    { homeScore: before.homeScore, awayScore: before.awayScore },
    { homeScore, awayScore }
  );

  revalidatePath(`/admin/partite/${id}`);
  revalidatePath(`/partite/${id}`);
  await revalidateDcupPublicPaths(id);
  return {};
}

export async function deleteMatch(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));

  if (!isValidId(id)) return { message: "Partita non valida." };
  const before = await db.match.findUnique({
    where: { id },
    include: { _count: { select: { goals: true, votes: true, bonuses: true } } },
  });
  if (!before) return { message: "Partita non trovata." };
  if (before.knockoutRoundId) {
    return { message: "Le partite del tabellone a eliminazione diretta non si eliminano da qui: usa la pagina \"Eliminazione diretta\"." };
  }
  if (before.status === MatchStatus.CONCLUDED || before._count.goals > 0 || before._count.votes > 0 || before._count.bonuses > 0) {
    return { message: "Non puoi eliminare una partita conclusa o con gol, voti o bonus: cancellerebbe i punti fanta collegati. Riportala indietro ed elimina prima i dati collegati." };
  }

  await db.match.delete({ where: { id } });
  await logAdminAction(Number(admin.id), "DELETE", "Match", id, { ...before, startsAt: before.startsAt.toISOString() }, null);

  revalidatePath("/admin/partite");
  await revalidateDcupPublicPaths(id);
  redirect("/admin/partite");
}
