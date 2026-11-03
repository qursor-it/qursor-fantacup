"use server";

import { Prisma, type VolleyMatchStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import {
  nextVolleySetNumber,
  volleySetMutationError,
  VOLLEY_MAX_SETS,
} from "@/lib/volley/rules";
import { revalidateVolleyPublicPaths } from "./revalidate-public";

type ActionResult = { error?: string } | undefined;

/** Tutte le action di questo file sono riservate agli admin: restituisce l'id per l'audit log. */
async function adminId(): Promise<number> {
  const admin = await requireAdmin();
  return Number(admin.id);
}

function toNumber(value: unknown): number {
  if (value === "" || value === null || value === undefined) return Number.NaN;
  return Number(value);
}

const idSchema = z.preprocess(toNumber, z.number().int().positive());
const optionalIdSchema = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return parsed === 0 ? null : parsed;
}, z.number().int().positive().nullable());
const pointsSchema = z.preprocess(toNumber, z.number().int().min(0).max(99));
const nonNegativeIntSchema = z.preprocess(toNumber, z.number().int().min(0));
const nameSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().min(1)
);
const dateInputSchema = z.preprocess(
  (value) => (typeof value === "string" ? value : ""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).or(z.literal(""))
);

/**
 * Il form invia l'orario "da muro" di Roma come `YYYY-MM-DDTHH:mm` (senza fuso).
 * Come per le partite di calcio (`parseMatchDateTimeInput`) lo salviamo come UTC
 * e lo mostriamo sempre con `timeZone: "UTC"`, così non dipende da ora legale/solare.
 */
function parseVolleyMatchDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const ONLY_ONE_PHASE_MSG = "Una partita può appartenere a un girone oppure a un turno a eliminazione diretta, non a entrambi.";

async function duplicateKnockoutMatch(
  knockoutRoundId: number,
  homeTeamId: number,
  awayTeamId: number,
  excludeId?: number
) {
  return db.volleyMatch.findFirst({
    where: {
      knockoutRoundId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { homeTeamId, awayTeamId },
        { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
      ],
    },
    select: { id: true },
  });
}

async function teamHasMatches(teamId: number) {
  const count = await db.volleyMatch.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  });
  return count > 0;
}

// ─── SQUADRE ──────────────────────────────────────────────────────────────────

export async function createVolleyTeam(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: "Nome obbligatorio" };
  const team = await db.volleyTeam.create({ data: { name: parsed.data } });
  await logAdminAction(admin, "CREATE", "VolleyTeam", team.id, null, team);
  revalidatePath("/admin/greenvolley/squadre");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/squadre");
}

export async function updateVolleyTeam(
  id: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Squadra non valida" };
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: "Nome obbligatorio" };
  const before = await db.volleyTeam.findUnique({ where: { id: parsedId.data } });
  if (!before) return { error: "Squadra non trovata" };
  const team = await db.volleyTeam.update({ where: { id: parsedId.data }, data: { name: parsed.data } });
  await logAdminAction(admin, "UPDATE", "VolleyTeam", parsedId.data, before, team);
  revalidatePath("/admin/greenvolley/squadre");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/squadre");
}

const TEAM_HAS_MATCHES_MSG = "Questa squadra ha partite in calendario: elimina prima le sue partite.";

export async function deleteVolleyTeam(id: number): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyTeam.findUnique({ where: { id } });
  if (!before) return;
  if (await teamHasMatches(id)) throw new Error(TEAM_HAS_MATCHES_MSG);
  await db.volleyTeam.delete({ where: { id } });
  await logAdminAction(admin, "DELETE", "VolleyTeam", id, before, null);
  revalidatePath("/admin/greenvolley/squadre");
  revalidateVolleyPublicPaths();
}

// ─── GIOCATORI ────────────────────────────────────────────────────────────────

export async function createVolleyPlayer(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedName = nameSchema.safeParse(formData.get("name"));
  const parsedTeam = idSchema.safeParse(formData.get("teamId"));
  if (!parsedName.success) return { error: "Nome obbligatorio" };
  if (!parsedTeam.success) return { error: "Squadra obbligatoria" };
  const player = await db.volleyPlayer.create({
    data: { name: parsedName.data, teamId: parsedTeam.data },
  });
  await logAdminAction(admin, "CREATE", "VolleyPlayer", player.id, null, player);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/giocatori");
}

export async function updateVolleyPlayer(
  id: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Giocatore non valido" };
  const parsedName = nameSchema.safeParse(formData.get("name"));
  const parsedTeam = idSchema.safeParse(formData.get("teamId"));
  if (!parsedName.success) return { error: "Nome obbligatorio" };
  if (!parsedTeam.success) return { error: "Squadra obbligatoria" };
  const before = await db.volleyPlayer.findUnique({ where: { id: parsedId.data } });
  if (!before) return { error: "Giocatore non trovato" };
  const player = await db.volleyPlayer.update({
    where: { id: parsedId.data },
    data: { name: parsedName.data, teamId: parsedTeam.data },
  });
  await logAdminAction(admin, "UPDATE", "VolleyPlayer", parsedId.data, before, player);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/giocatori");
}

export async function deleteVolleyPlayer(id: number): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyPlayer.findUnique({ where: { id } });
  if (!before) return;
  await db.volleyPlayer.delete({ where: { id } });
  await logAdminAction(admin, "DELETE", "VolleyPlayer", id, before, null);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
}

// ─── PARTITE ──────────────────────────────────────────────────────────────────

export async function createVolleyMatch(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedHome = idSchema.safeParse(formData.get("homeTeamId"));
  const parsedAway = idSchema.safeParse(formData.get("awayTeamId"));
  const parsedDate = dateInputSchema.safeParse(formData.get("date"));
  const parsedGroup = optionalIdSchema.safeParse(formData.get("groupId"));
  const parsedRound = optionalIdSchema.safeParse(formData.get("knockoutRoundId"));

  if (!parsedHome.success || !parsedAway.success) return { error: "Seleziona entrambe le squadre" };
  if (parsedHome.data === parsedAway.data) return { error: "Le squadre devono essere diverse" };
  if (!parsedDate.success) return { error: "Data non valida" };
  if (!parsedGroup.success || !parsedRound.success) return { error: "Girone o turno non valido" };

  const dateRaw = parsedDate.data || null;
  if (dateRaw && !parseVolleyMatchDate(dateRaw)) return { error: "Data non valida" };

  const homeTeamId = parsedHome.data;
  const awayTeamId = parsedAway.data;
  const groupId = parsedGroup.data;
  const knockoutRoundId = parsedRound.data;
  if (groupId && knockoutRoundId) return { error: ONLY_ONE_PHASE_MSG };

  // Evita di duplicare per errore la stessa partita (es. la Finale) nello stesso turno.
  if (knockoutRoundId && (await duplicateKnockoutMatch(knockoutRoundId, homeTeamId, awayTeamId))) {
    return { error: "Questa partita esiste già in questo turno di eliminazione diretta." };
  }

  const created = await db.volleyMatch.create({
    data: {
      homeTeamId,
      awayTeamId,
      date: parseVolleyMatchDate(dateRaw),
      groupId,
      knockoutRoundId,
    },
  });
  await logAdminAction(admin, "CREATE", "VolleyMatch", created.id, null, created);
  revalidatePath("/admin/greenvolley/partite");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/partite");
}

export async function updateVolleyMatch(
  id: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: "Partita non valida" };

  const parsedHome = idSchema.safeParse(formData.get("homeTeamId"));
  const parsedAway = idSchema.safeParse(formData.get("awayTeamId"));
  const parsedDate = dateInputSchema.safeParse(formData.get("date"));
  const parsedGroup = optionalIdSchema.safeParse(formData.get("groupId"));
  const parsedRound = optionalIdSchema.safeParse(formData.get("knockoutRoundId"));
  const parsedHomeDisc = nonNegativeIntSchema.safeParse(formData.get("homeDisciplinaryPoints"));
  const parsedAwayDisc = nonNegativeIntSchema.safeParse(formData.get("awayDisciplinaryPoints"));

  if (!parsedHome.success || !parsedAway.success) return { error: "Seleziona entrambe le squadre" };
  if (parsedHome.data === parsedAway.data) return { error: "Le squadre devono essere diverse" };
  if (!parsedDate.success) return { error: "Data non valida" };
  if (!parsedGroup.success || !parsedRound.success) return { error: "Girone o turno non valido" };
  if (!parsedHomeDisc.success || !parsedAwayDisc.success) {
    return { error: "Punteggio disciplinare non valido" };
  }

  const dateRaw = parsedDate.data || null;
  if (dateRaw && !parseVolleyMatchDate(dateRaw)) return { error: "Data non valida" };

  const homeTeamId = parsedHome.data;
  const awayTeamId = parsedAway.data;
  const groupId = parsedGroup.data;
  const knockoutRoundId = parsedRound.data;
  if (groupId && knockoutRoundId) return { error: ONLY_ONE_PHASE_MSG };

  if (knockoutRoundId && (await duplicateKnockoutMatch(knockoutRoundId, homeTeamId, awayTeamId, parsedId.data))) {
    return { error: "Questa partita esiste già in questo turno di eliminazione diretta." };
  }

  const before = await db.volleyMatch.findUnique({ where: { id: parsedId.data } });
  if (!before) return { error: "Partita non trovata" };

  const updated = await db.volleyMatch.update({
    where: { id: parsedId.data },
    data: {
      homeTeamId,
      awayTeamId,
      date: parseVolleyMatchDate(dateRaw),
      groupId,
      knockoutRoundId,
      homeDisciplinaryPoints: parsedHomeDisc.data,
      awayDisciplinaryPoints: parsedAwayDisc.data,
    },
  });
  await logAdminAction(admin, "UPDATE", "VolleyMatch", parsedId.data, before, updated);
  revalidatePath("/admin/greenvolley/partite");
  revalidatePath(`/admin/greenvolley/partite/${parsedId.data}`);
  revalidateVolleyPublicPaths(parsedId.data);
  redirect(`/admin/greenvolley/partite/${parsedId.data}`);
}

const DELETE_CONCLUDED_MATCH_MSG =
  "Non puoi eliminare una partita conclusa: riaprila prima di eliminare la partita e i suoi set.";

export async function deleteVolleyMatch(id: number): Promise<ActionResult> {
  const admin = await adminId();
  const before = await db.volleyMatch.findUnique({ where: { id }, include: { sets: true } });
  if (!before) return undefined;
  if (before.status === "CONCLUDED") return { error: DELETE_CONCLUDED_MATCH_MSG };
  await db.volleyMatch.delete({ where: { id } });
  await logAdminAction(admin, "DELETE", "VolleyMatch", id, before, null);
  revalidatePath("/admin/greenvolley/partite");
  revalidateVolleyPublicPaths(id);
  return undefined;
}

async function setVolleyMatchStatus(
  id: number,
  from: VolleyMatchStatus[],
  to: VolleyMatchStatus
): Promise<ActionResult> {
  const admin = await adminId();
  const match = await db.volleyMatch.findUnique({ where: { id }, include: { sets: true } });
  if (!match) return { error: "Partita non trovata" };
  if (!from.includes(match.status)) return { error: "Passaggio di stato non consentito" };
  if (to === "CONCLUDED") {
    // Serve almeno un set e un vincitore, altrimenti la classifica conta una partita "giocata" senza esito.
    const home = match.sets.filter((s) => s.homePoints > s.awayPoints).length;
    const away = match.sets.filter((s) => s.awayPoints > s.homePoints).length;
    if (match.sets.length === 0 || home === away) {
      return { error: "Per concludere la partita servono i set e un vincitore" };
    }
  }
  await db.volleyMatch.update({ where: { id }, data: { status: to } });
  await logAdminAction(admin, "UPDATE_STATUS", "VolleyMatch", id, { status: match.status }, { status: to });
  return undefined;
}

export async function scheduleVolleyMatch(id: number): Promise<ActionResult> {
  const result = await setVolleyMatchStatus(id, ["DRAFT"], "SCHEDULED");
  if (result?.error) return result;
  revalidatePath(`/admin/greenvolley/partite/${id}`);
  revalidateVolleyPublicPaths(id);
  return undefined;
}

export async function concludeVolleyMatch(id: number): Promise<ActionResult> {
  const result = await setVolleyMatchStatus(id, ["SCHEDULED"], "CONCLUDED");
  if (result?.error) return result;
  revalidatePath(`/admin/greenvolley/partite/${id}`);
  revalidatePath("/greenvolley/classifica");
  revalidateVolleyPublicPaths(id);
  return undefined;
}

export async function reopenVolleyMatch(id: number): Promise<ActionResult> {
  const result = await setVolleyMatchStatus(id, ["CONCLUDED"], "SCHEDULED");
  if (result?.error) return result;
  revalidatePath(`/admin/greenvolley/partite/${id}`);
  revalidateVolleyPublicPaths(id);
  return undefined;
}

// ─── SET ──────────────────────────────────────────────────────────────────────

export async function addVolleySet(
  matchId: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedMatch = idSchema.safeParse(matchId);
  const parsedHome = pointsSchema.safeParse(formData.get("homePoints"));
  const parsedAway = pointsSchema.safeParse(formData.get("awayPoints"));

  if (!parsedMatch.success) return { error: "Partita non valida" };
  if (!parsedHome.success) return { error: "Punti casa non validi" };
  if (!parsedAway.success) return { error: "Punti ospiti non validi" };
  if (parsedHome.data === parsedAway.data) return { error: "Un set non può finire in parità" };

  let result: { error: string } | { set: Awaited<ReturnType<typeof db.volleySet.create>> };
  try {
    result = await db.$transaction(async (tx) => {
      const match = await tx.volleyMatch.findUnique({
        where: { id: parsedMatch.data },
        select: { id: true, status: true },
      });
      if (!match) return { error: "Partita non trovata" };
      const locked = volleySetMutationError(match.status);
      if (locked) return { error: locked };

      const existing = await tx.volleySet.findMany({
        where: { matchId: parsedMatch.data },
        select: { setNumber: true },
      });
      const setNumber = nextVolleySetNumber(existing);
      if (setNumber === null) return { error: `Massimo ${VOLLEY_MAX_SETS} set per partita` };

      const set = await tx.volleySet.create({
        data: {
          matchId: parsedMatch.data,
          setNumber,
          homePoints: parsedHome.data,
          awayPoints: parsedAway.data,
        },
      });
      return { set };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Questo set è già stato registrato da un'altra operazione: ricarica e riprova." };
    }
    throw error;
  }

  if ("error" in result) return { error: result.error };
  await logAdminAction(admin, "CREATE", "VolleySet", result.set.id, null, result.set);
  revalidatePath(`/admin/greenvolley/partite/${parsedMatch.data}`);
  revalidateVolleyPublicPaths(parsedMatch.data);
}

export async function updateVolleySet(
  setId: number,
  matchId: number,
  homePoints: number,
  awayPoints: number
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedSet = idSchema.safeParse(setId);
  const parsedMatch = idSchema.safeParse(matchId);
  const parsedHome = pointsSchema.safeParse(homePoints);
  const parsedAway = pointsSchema.safeParse(awayPoints);

  if (!parsedSet.success) return { error: "Set non valido" };
  if (!parsedMatch.success) return { error: "Partita non valida" };
  if (!parsedHome.success) return { error: "Punti casa non validi" };
  if (!parsedAway.success) return { error: "Punti ospiti non validi" };
  if (parsedHome.data === parsedAway.data) return { error: "Un set non può finire in parità" };

  const targetSet = await db.volleySet.findFirst({
    where: { id: parsedSet.data, matchId: parsedMatch.data },
    select: {
      id: true,
      homePoints: true,
      awayPoints: true,
      match: { select: { status: true } },
    },
  });
  if (!targetSet) return { error: "Set non trovato" };
  const locked = volleySetMutationError(targetSet.match.status);
  if (locked) return { error: locked };

  await logAdminAction(admin, "UPDATE", "VolleySet", parsedSet.data, targetSet, {
    homePoints: parsedHome.data,
    awayPoints: parsedAway.data,
  });
  await db.volleySet.update({
    where: { id: parsedSet.data },
    data: { homePoints: parsedHome.data, awayPoints: parsedAway.data },
  });
  revalidatePath(`/admin/greenvolley/partite/${parsedMatch.data}`);
  revalidateVolleyPublicPaths(parsedMatch.data);
}

export async function deleteVolleySet(setId: number, matchId: number): Promise<ActionResult> {
  const admin = await adminId();
  const parsedSet = idSchema.safeParse(setId);
  const parsedMatch = idSchema.safeParse(matchId);
  if (!parsedSet.success) return { error: "Set non valido" };
  if (!parsedMatch.success) return { error: "Partita non valida" };

  const before = await db.volleySet.findFirst({
    where: { id: parsedSet.data, matchId: parsedMatch.data },
    include: { match: { select: { status: true } } },
  });
  if (!before) return undefined;
  const locked = volleySetMutationError(before.match.status);
  if (locked) return { error: locked };

  const { match: _match, ...setBefore } = before;
  try {
    await db.$transaction(async (tx) => {
      await tx.volleySet.delete({ where: { id: parsedSet.data } });
      // Rinumera i set rimanenti
      const remaining = await tx.volleySet.findMany({
        where: { matchId: parsedMatch.data },
        orderBy: { setNumber: "asc" },
      });
      for (let i = 0; i < remaining.length; i++) {
        await tx.volleySet.update({
          where: { id: remaining[i].id },
          data: { setNumber: i + 1 },
        });
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { error: "Impossibile eliminare il set: riprova." };
    }
    throw error;
  }
  await logAdminAction(admin, "DELETE", "VolleySet", parsedSet.data, setBefore, null);
  revalidatePath(`/admin/greenvolley/partite/${parsedMatch.data}`);
  revalidateVolleyPublicPaths(parsedMatch.data);
}

// ─── GIRONI ───────────────────────────────────────────────────────────────────

export async function createVolleyGroup(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: "Nome obbligatorio" };
  const group = await db.volleyGroup.create({ data: { name: parsed.data } });
  await logAdminAction(admin, "CREATE", "VolleyGroup", group.id, null, group);
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/gironi");
}

const GROUP_HAS_CONCLUDED_MSG =
  "Impossibile eliminare: il girone ha partite concluse.";
const ROUND_HAS_CONCLUDED_MSG =
  "Impossibile eliminare: il turno ha partite concluse.";

export async function deleteVolleyGroup(id: number): Promise<void> {
  const admin = await adminId();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return;
  const before = await db.volleyGroup.findUnique({
    where: { id: parsedId.data },
    include: { teams: true },
  });
  if (!before) return;
  const concluded = await db.volleyMatch.count({
    where: { groupId: parsedId.data, status: "CONCLUDED" },
  });
  if (concluded > 0) throw new Error(GROUP_HAS_CONCLUDED_MSG);
  await db.volleyGroup.delete({ where: { id: parsedId.data } });
  await logAdminAction(admin, "DELETE", "VolleyGroup", parsedId.data, before, null);
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

export async function addTeamToVolleyGroup(
  groupId: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedGroup = idSchema.safeParse(groupId);
  const parsedTeam = idSchema.safeParse(formData.get("teamId"));
  if (!parsedGroup.success) return { error: "Girone non valido" };
  if (!parsedTeam.success) return { error: "Seleziona una squadra" };
  const group = await db.volleyGroup.findUnique({
    where: { id: parsedGroup.data },
    select: { id: true },
  });
  if (!group) return { error: "Girone non trovato" };
  const exists = await db.volleyGroupTeam.findUnique({
    where: { groupId_teamId: { groupId: parsedGroup.data, teamId: parsedTeam.data } },
  });
  if (exists) return { error: "Squadra già nel girone" };
  await db.volleyGroupTeam.create({
    data: { groupId: parsedGroup.data, teamId: parsedTeam.data },
  });
  await logAdminAction(admin, "ADD_TEAM", "VolleyGroup", parsedGroup.data, null, {
    teamId: parsedTeam.data,
  });
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

export async function removeTeamFromVolleyGroup(
  groupId: number,
  teamId: number
): Promise<void> {
  const admin = await adminId();
  const parsedGroup = idSchema.safeParse(groupId);
  const parsedTeam = idSchema.safeParse(teamId);
  if (!parsedGroup.success || !parsedTeam.success) return;
  const before = await db.volleyGroupTeam.findUnique({
    where: {
      groupId_teamId: { groupId: parsedGroup.data, teamId: parsedTeam.data },
    },
  });
  if (!before) return;
  await db.volleyGroupTeam.delete({
    where: {
      groupId_teamId: { groupId: parsedGroup.data, teamId: parsedTeam.data },
    },
  });
  await logAdminAction(admin, "REMOVE_TEAM", "VolleyGroup", parsedGroup.data, before, null);
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

export async function setVolleyTeamQualified(
  groupId: number,
  teamId: number,
  qualified: boolean
): Promise<void> {
  const admin = await adminId();
  const parsedGroup = idSchema.safeParse(groupId);
  const parsedTeam = idSchema.safeParse(teamId);
  if (!parsedGroup.success || !parsedTeam.success) return;
  const before = await db.volleyGroupTeam.findUnique({
    where: {
      groupId_teamId: { groupId: parsedGroup.data, teamId: parsedTeam.data },
    },
  });
  if (!before) return;
  await db.volleyGroupTeam.update({
    where: {
      groupId_teamId: { groupId: parsedGroup.data, teamId: parsedTeam.data },
    },
    data: { qualified },
  });
  await logAdminAction(admin, "SET_QUALIFIED", "VolleyGroup", parsedGroup.data, before, {
    teamId: parsedTeam.data,
    qualified,
  });
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

// ─── KNOCKOUT ─────────────────────────────────────────────────────────────────

export async function createVolleyKnockoutRound(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedName = nameSchema.safeParse(formData.get("name"));
  const parsedOrder = idSchema.safeParse(formData.get("order"));
  if (!parsedName.success) return { error: "Nome obbligatorio" };
  if (!parsedOrder.success) return { error: "Ordine obbligatorio" };
  const round = await db.volleyKnockoutRound.create({
    data: { name: parsedName.data, order: parsedOrder.data },
  });
  await logAdminAction(admin, "CREATE", "VolleyKnockoutRound", round.id, null, round);
  revalidatePath("/admin/greenvolley/eliminazione");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/eliminazione");
}

export async function deleteVolleyKnockoutRound(id: number): Promise<void> {
  const admin = await adminId();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return;
  const before = await db.volleyKnockoutRound.findUnique({ where: { id: parsedId.data } });
  if (!before) return;
  const concluded = await db.volleyMatch.count({
    where: { knockoutRoundId: parsedId.data, status: "CONCLUDED" },
  });
  if (concluded > 0) throw new Error(ROUND_HAS_CONCLUDED_MSG);
  await db.volleyKnockoutRound.delete({ where: { id: parsedId.data } });
  await logAdminAction(admin, "DELETE", "VolleyKnockoutRound", parsedId.data, before, null);
  revalidatePath("/admin/greenvolley/eliminazione");
  revalidateVolleyPublicPaths();
}

export async function createVolleyPlayerForTeam(
  teamId: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const parsedTeam = idSchema.safeParse(teamId);
  const parsedName = nameSchema.safeParse(formData.get("name"));
  if (!parsedTeam.success) return { error: "Squadra non valida" };
  if (!parsedName.success) return { error: "Nome obbligatorio" };
  const player = await db.volleyPlayer.create({
    data: { name: parsedName.data, teamId: parsedTeam.data },
  });
  await logAdminAction(admin, "CREATE", "VolleyPlayer", player.id, null, player);
  revalidatePath(`/admin/greenvolley/squadre/${parsedTeam.data}/edit`);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
  return undefined;
}

export async function removeVolleyPlayerById(playerId: number): Promise<void> {
  const admin = await adminId();
  const parsedId = idSchema.safeParse(playerId);
  if (!parsedId.success) return;
  const player = await db.volleyPlayer.findUnique({ where: { id: parsedId.data } });
  if (!player) return;
  await db.volleyPlayer.delete({ where: { id: parsedId.data } });
  await logAdminAction(admin, "DELETE", "VolleyPlayer", parsedId.data, player, null);
  revalidatePath(`/admin/greenvolley/squadre/${player.teamId}/edit`);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
}

// ─── FORM DELETE VARIANTS (for ConfirmDeleteForm) ─────────────────────────────

export async function deleteVolleyTeamForm(
  _prev: unknown,
  formData: FormData
): Promise<{ message?: string } | void> {
  // L'admin check viene prima di qualsiasi query sull'id inviato dal form.
  await adminId();
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { message: "Squadra non valida." };
  if (await teamHasMatches(parsed.data)) return { message: TEAM_HAS_MATCHES_MSG };
  await deleteVolleyTeam(parsed.data);
}

export async function deleteVolleyPlayerForm(_prev: unknown, formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;
  await deleteVolleyPlayer(parsed.data);
}

export async function deleteVolleyMatchForm(
  _prev: unknown,
  formData: FormData
): Promise<{ message?: string } | void> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return { message: "Partita non valida." };
  const result = await deleteVolleyMatch(parsed.data);
  if (result?.error) return { message: result.error };
}
