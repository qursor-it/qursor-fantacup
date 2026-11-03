"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import {
  buildFootballTeamPayload,
  FootballTeamFormSchema,
} from "@/lib/football-team-form";
import { revalidateDcupPublicPaths } from "./revalidate-public";

const Schema = FootballTeamFormSchema;

export type ActionResult = { errors?: Record<string, string[]>; message?: string };

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createFootballTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = Schema.safeParse({
    name: formData.get("name"),
    shortName: formData.get("shortName") || undefined,
    countryCode: formData.get("countryCode") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const payload = buildFootballTeamPayload(parsed.data);

  const existing = await db.footballTeam.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { errors: { name: ["Nome già esistente."] } };

  let team;
  try {
    team = await db.footballTeam.create({ data: payload });
  } catch (e) {
    if (isUniqueViolation(e)) return { errors: { name: ["Nome già esistente."] } };
    throw e;
  }
  await logAdminAction(Number(admin.id), "CREATE", "FootballTeam", team.id, null, team);

  revalidatePath("/admin/squadre");
  await revalidateDcupPublicPaths();
  redirect("/admin/squadre");
}

export async function updateFootballTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Squadra non valida." };
  const parsed = Schema.safeParse({
    name: formData.get("name"),
    shortName: formData.get("shortName") || undefined,
    countryCode: formData.get("countryCode") || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const payload = buildFootballTeamPayload(parsed.data);

  const before = await db.footballTeam.findUnique({ where: { id } });
  if (!before) return { message: "Squadra non trovata." };

  const conflict = await db.footballTeam.findFirst({
    where: { name: payload.name, id: { not: id } },
    select: { id: true },
  });
  if (conflict) return { errors: { name: ["Nome già esistente."] } };

  let team;
  try {
    team = await db.footballTeam.update({ where: { id }, data: payload });
  } catch (e) {
    if (isUniqueViolation(e)) return { errors: { name: ["Nome già esistente."] } };
    throw e;
  }
  await logAdminAction(Number(admin.id), "UPDATE", "FootballTeam", id, before, team);

  revalidatePath("/admin/squadre");
  await revalidateDcupPublicPaths();
  redirect("/admin/squadre");
}

export async function deleteFootballTeam(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { message: "Squadra non valida." };

  const before = await db.footballTeam.findUnique({ where: { id } });
  if (!before) return { message: "Squadra non trovata." };

  try {
    await db.footballTeam.delete({ where: { id } });
    await logAdminAction(Number(admin.id), "DELETE", "FootballTeam", id, before, null);
  } catch {
    return { message: "Impossibile eliminare: la squadra ha giocatori o partite associate." };
  }

  revalidatePath("/admin/squadre");
  await revalidateDcupPublicPaths();
  redirect("/admin/squadre");
}
