"use server";

import type { VolleyMatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { revalidateVolleyPublicPaths } from "./revalidate-public";

type ActionResult = { error?: string } | undefined;

/** Tutte le action di questo file sono riservate agli admin: restituisce l'id per l'audit log. */
async function adminId(): Promise<number> {
  const admin = await requireAdmin();
  return Number(admin.id);
}

function isValidId(id: number) {
  return Number.isInteger(id) && id > 0;
}

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

function parseNonNegativeInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

// ─── SQUADRE ──────────────────────────────────────────────────────────────────

export async function createVolleyTeam(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Nome obbligatorio" };
  const team = await db.volleyTeam.create({ data: { name } });
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
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Nome obbligatorio" };
  const before = await db.volleyTeam.findUnique({ where: { id } });
  if (!before) return { error: "Squadra non trovata" };
  const team = await db.volleyTeam.update({ where: { id }, data: { name } });
  await logAdminAction(admin, "UPDATE", "VolleyTeam", id, before, team);
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
  const name = (formData.get("name") as string | null)?.trim();
  const teamId = Number(formData.get("teamId"));
  if (!name) return { error: "Nome obbligatorio" };
  if (!isValidId(teamId)) return { error: "Squadra obbligatoria" };
  const player = await db.volleyPlayer.create({ data: { name, teamId } });
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
  const name = (formData.get("name") as string | null)?.trim();
  const teamId = Number(formData.get("teamId"));
  if (!name) return { error: "Nome obbligatorio" };
  if (!isValidId(teamId)) return { error: "Squadra obbligatoria" };
  const before = await db.volleyPlayer.findUnique({ where: { id } });
  if (!before) return { error: "Giocatore non trovato" };
  const player = await db.volleyPlayer.update({ where: { id }, data: { name, teamId } });
  await logAdminAction(admin, "UPDATE", "VolleyPlayer", id, before, player);
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
  const homeTeamId = Number(formData.get("homeTeamId"));
  const awayTeamId = Number(formData.get("awayTeamId"));
  const dateRaw = formData.get("date") as string | null;
  const groupId = Number(formData.get("groupId")) || null;
  const knockoutRoundId = Number(formData.get("knockoutRoundId")) || null;

  if (!isValidId(homeTeamId) || !isValidId(awayTeamId)) return { error: "Seleziona entrambe le squadre" };
  if (homeTeamId === awayTeamId) return { error: "Le squadre devono essere diverse" };
  if (groupId && knockoutRoundId) return { error: ONLY_ONE_PHASE_MSG };
  if (dateRaw && !parseVolleyMatchDate(dateRaw)) return { error: "Data non valida" };

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
  const homeTeamId = Number(formData.get("homeTeamId"));
  const awayTeamId = Number(formData.get("awayTeamId"));
  const dateRaw = formData.get("date") as string | null;
  const groupId = Number(formData.get("groupId")) || null;
  const knockoutRoundId = Number(formData.get("knockoutRoundId")) || null;
  const homeDisciplinaryPoints = parseNonNegativeInteger(formData.get("homeDisciplinaryPoints"));
  const awayDisciplinaryPoints = parseNonNegativeInteger(formData.get("awayDisciplinaryPoints"));

  const admin = await adminId();
  if (!isValidId(homeTeamId) || !isValidId(awayTeamId)) return { error: "Seleziona entrambe le squadre" };
  if (homeTeamId === awayTeamId) return { error: "Le squadre devono essere diverse" };
  if (groupId && knockoutRoundId) return { error: ONLY_ONE_PHASE_MSG };
  if (dateRaw && !parseVolleyMatchDate(dateRaw)) return { error: "Data non valida" };
  if (homeDisciplinaryPoints === null || awayDisciplinaryPoints === null) {
    return { error: "Punteggio disciplinare non valido" };
  }
  if (knockoutRoundId && (await duplicateKnockoutMatch(knockoutRoundId, homeTeamId, awayTeamId, id))) {
    return { error: "Questa partita esiste già in questo turno di eliminazione diretta." };
  }

  const before = await db.volleyMatch.findUnique({ where: { id } });
  if (!before) return { error: "Partita non trovata" };

  const updated = await db.volleyMatch.update({
    where: { id },
    data: {
      homeTeamId,
      awayTeamId,
      date: parseVolleyMatchDate(dateRaw),
      groupId,
      knockoutRoundId,
      homeDisciplinaryPoints,
      awayDisciplinaryPoints,
    },
  });
  await logAdminAction(admin, "UPDATE", "VolleyMatch", id, before, updated);
  revalidatePath("/admin/greenvolley/partite");
  revalidatePath(`/admin/greenvolley/partite/${id}`);
  revalidateVolleyPublicPaths(id);
  redirect(`/admin/greenvolley/partite/${id}`);
}

export async function deleteVolleyMatch(id: number): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyMatch.findUnique({ where: { id }, include: { sets: true } });
  if (!before) return;
  await db.volleyMatch.delete({ where: { id } });
  await logAdminAction(admin, "DELETE", "VolleyMatch", id, before, null);
  revalidatePath("/admin/greenvolley/partite");
  revalidateVolleyPublicPaths(id);
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
  const homePoints = parseNonNegativeInteger(formData.get("homePoints"));
  const awayPoints = parseNonNegativeInteger(formData.get("awayPoints"));

  if (homePoints === null) return { error: "Punti casa non validi" };
  if (awayPoints === null) return { error: "Punti ospiti non validi" };
  if (homePoints === awayPoints) return { error: "Un set non può finire in parità" };

  const match = await db.volleyMatch.findUnique({ where: { id: matchId }, select: { id: true } });
  if (!match) return { error: "Partita non trovata" };

  const set = await db.$transaction(async (tx) => {
    const existing = await tx.volleySet.count({ where: { matchId } });
    if (existing >= 5) return null;
    return tx.volleySet.create({
      data: { matchId, setNumber: existing + 1, homePoints, awayPoints },
    });
  });
  if (!set) return { error: "Massimo 5 set per partita" };
  await logAdminAction(admin, "CREATE", "VolleySet", set.id, null, set);
  revalidatePath(`/admin/greenvolley/partite/${matchId}`);
  revalidateVolleyPublicPaths(matchId);
}

export async function updateVolleySet(
  setId: number,
  matchId: number,
  homePoints: number,
  awayPoints: number
): Promise<ActionResult> {
  const admin = await adminId();
  if (!Number.isInteger(homePoints) || homePoints < 0) {
    return { error: "Punti casa non validi" };
  }
  if (!Number.isInteger(awayPoints) || awayPoints < 0) {
    return { error: "Punti ospiti non validi" };
  }
  if (homePoints === awayPoints) return { error: "Un set non può finire in parità" };

  const targetSet = await db.volleySet.findFirst({ where: { id: setId, matchId } });
  if (!targetSet) return { error: "Set non trovato" };

  await logAdminAction(admin, "UPDATE", "VolleySet", setId, targetSet, { homePoints, awayPoints });
  await db.volleySet.update({
    where: { id: setId },
    data: { homePoints, awayPoints },
  });
  revalidatePath(`/admin/greenvolley/partite/${matchId}`);
  revalidateVolleyPublicPaths(matchId);
}

export async function deleteVolleySet(setId: number, matchId: number): Promise<void> {
  const admin = await adminId();
  const before = await db.volleySet.findFirst({ where: { id: setId, matchId } });
  if (!before) return;
  await db.$transaction(async (tx) => {
    await tx.volleySet.delete({ where: { id: setId } });
    // Rinumera i set rimanenti
    const remaining = await tx.volleySet.findMany({
      where: { matchId },
      orderBy: { setNumber: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      await tx.volleySet.update({
        where: { id: remaining[i].id },
        data: { setNumber: i + 1 },
      });
    }
  });
  await logAdminAction(admin, "DELETE", "VolleySet", setId, before, null);
  revalidatePath(`/admin/greenvolley/partite/${matchId}`);
  revalidateVolleyPublicPaths(matchId);
}

// ─── GIRONI ───────────────────────────────────────────────────────────────────

export async function createVolleyGroup(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Nome obbligatorio" };
  const group = await db.volleyGroup.create({ data: { name } });
  await logAdminAction(admin, "CREATE", "VolleyGroup", group.id, null, group);
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/gironi");
}

export async function deleteVolleyGroup(id: number): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyGroup.findUnique({ where: { id }, include: { teams: true } });
  if (!before) return;
  await db.volleyGroup.delete({ where: { id } });
  await logAdminAction(admin, "DELETE", "VolleyGroup", id, before, null);
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

export async function addTeamToVolleyGroup(
  groupId: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const teamId = Number(formData.get("teamId"));
  if (!isValidId(teamId)) return { error: "Seleziona una squadra" };
  const group = await db.volleyGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return { error: "Girone non trovato" };
  const exists = await db.volleyGroupTeam.findUnique({
    where: { groupId_teamId: { groupId, teamId } },
  });
  if (exists) return { error: "Squadra già nel girone" };
  await db.volleyGroupTeam.create({ data: { groupId, teamId } });
  await logAdminAction(admin, "ADD_TEAM", "VolleyGroup", groupId, null, { teamId });
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

export async function removeTeamFromVolleyGroup(
  groupId: number,
  teamId: number
): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyGroupTeam.findUnique({
    where: { groupId_teamId: { groupId, teamId } },
  });
  if (!before) return;
  await db.volleyGroupTeam.delete({
    where: { groupId_teamId: { groupId, teamId } },
  });
  await logAdminAction(admin, "REMOVE_TEAM", "VolleyGroup", groupId, before, null);
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

export async function setVolleyTeamQualified(
  groupId: number,
  teamId: number,
  qualified: boolean
): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyGroupTeam.findUnique({
    where: { groupId_teamId: { groupId, teamId } },
  });
  if (!before) return;
  await db.volleyGroupTeam.update({
    where: { groupId_teamId: { groupId, teamId } },
    data: { qualified },
  });
  await logAdminAction(admin, "SET_QUALIFIED", "VolleyGroup", groupId, before, { teamId, qualified });
  revalidatePath("/admin/greenvolley/gironi");
  revalidateVolleyPublicPaths();
}

// ─── KNOCKOUT ─────────────────────────────────────────────────────────────────

export async function createVolleyKnockoutRound(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const name = (formData.get("name") as string | null)?.trim();
  const order = Number(formData.get("order"));
  if (!name) return { error: "Nome obbligatorio" };
  if (!isValidId(order)) return { error: "Ordine obbligatorio" };
  const round = await db.volleyKnockoutRound.create({ data: { name, order } });
  await logAdminAction(admin, "CREATE", "VolleyKnockoutRound", round.id, null, round);
  revalidatePath("/admin/greenvolley/eliminazione");
  revalidateVolleyPublicPaths();
  redirect("/admin/greenvolley/eliminazione");
}

export async function deleteVolleyKnockoutRound(id: number): Promise<void> {
  const admin = await adminId();
  const before = await db.volleyKnockoutRound.findUnique({ where: { id } });
  if (!before) return;
  await db.volleyKnockoutRound.delete({ where: { id } });
  await logAdminAction(admin, "DELETE", "VolleyKnockoutRound", id, before, null);
  revalidatePath("/admin/greenvolley/eliminazione");
  revalidateVolleyPublicPaths();
}

export async function createVolleyPlayerForTeam(
  teamId: number,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await adminId();
  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return { error: "Nome obbligatorio" };
  const player = await db.volleyPlayer.create({ data: { name, teamId } });
  await logAdminAction(admin, "CREATE", "VolleyPlayer", player.id, null, player);
  revalidatePath(`/admin/greenvolley/squadre/${teamId}/edit`);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
  return undefined;
}

export async function removeVolleyPlayerById(playerId: number): Promise<void> {
  const admin = await adminId();
  const player = await db.volleyPlayer.findUnique({ where: { id: playerId } });
  if (!player) return;
  await db.volleyPlayer.delete({ where: { id: playerId } });
  await logAdminAction(admin, "DELETE", "VolleyPlayer", playerId, player, null);
  revalidatePath(`/admin/greenvolley/squadre/${player.teamId}/edit`);
  revalidatePath("/admin/greenvolley/giocatori");
  revalidateVolleyPublicPaths();
}

// ─── FORM DELETE VARIANTS (for ConfirmDeleteForm) ─────────────────────────────

export async function deleteVolleyTeamForm(
  _prev: unknown,
  formData: FormData
): Promise<{ message?: string } | void> {
  const id = Number(formData.get("id"));
  if (!isValidId(id)) return;
  if (await teamHasMatches(id)) return { message: TEAM_HAS_MATCHES_MSG };
  await deleteVolleyTeam(id);
}

export async function deleteVolleyPlayerForm(_prev: unknown, formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!isValidId(id)) return;
  await deleteVolleyPlayer(id);
}

export async function deleteVolleyMatchForm(_prev: unknown, formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!isValidId(id)) return;
  await deleteVolleyMatch(id);
}
