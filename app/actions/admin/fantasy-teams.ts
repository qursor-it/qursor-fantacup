"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";
import { validateRoster } from "@/lib/domain/roster";
import { fantasyTeamNameSchema } from "@/lib/domain/fantasy-team";
import type { ActionResult } from "./football-teams";
import { revalidateFantasyPublicPaths } from "./revalidate-public";
import { PlayerRole } from "@prisma/client";

const UpdateRosterSchema = z.object({
  fantasyTeamId: z.coerce.number().int().positive(),
  name: fantasyTeamNameSchema,
  captainPlayerId: z.coerce.number().int().positive("Capitano obbligatorio"),
  playerIds: z.array(z.coerce.number().int().positive()).length(5, "Servono esattamente 5 giocatori"),
});

export async function adminUpdateFantasyRoster(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const rawPlayerIds = formData.getAll("playerIds").map(Number);
  const parsed = UpdateRosterSchema.safeParse({
    fantasyTeamId: formData.get("fantasyTeamId"),
    name: formData.get("name"),
    captainPlayerId: formData.get("captainPlayerId"),
    playerIds: rawPlayerIds,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const { fantasyTeamId, name, captainPlayerId, playerIds } = parsed.data;
  if (new Set(playerIds).size !== playerIds.length) return { message: "La rosa contiene giocatori duplicati." };

  const before = await db.fantasyTeam.findUnique({
    where: { id: fantasyTeamId },
    include: { players: true },
  });
  if (!before) return { message: "Squadra fantasy non trovata." };

  // Carica i player per validazione
  const players = await db.player.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, role: true, footballTeamId: true },
  });

  if (players.length !== 5) return { message: "Uno o più giocatori non trovati." };

  const rosterError = validateRoster(
    players.map((p) => ({ playerId: p.id, role: p.role as PlayerRole, footballTeamId: p.footballTeamId })),
    captainPlayerId
  );
  if (rosterError) return { message: `Rosa non valida: ${rosterError}` };

  await db.$transaction([
    db.fantasyTeamPlayer.deleteMany({ where: { fantasyTeamId } }),
    db.fantasyTeamPlayer.createMany({ data: playerIds.map((playerId) => ({ fantasyTeamId, playerId })) }),
    db.fantasyTeam.update({ where: { id: fantasyTeamId }, data: { name, captainPlayerId } }),
  ]);

  await logAdminAction(Number(admin.id), "UPDATE_ROSTER", "FantasyTeam", fantasyTeamId, before, { name, captainPlayerId, playerIds });

  revalidatePath(`/admin/squadre-fantasy/${fantasyTeamId}`);
  await revalidateFantasyPublicPaths(fantasyTeamId);
  return { message: "Rosa aggiornata." };
}
