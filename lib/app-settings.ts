import "server-only";

import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";

export async function getRegistrationOpen(): Promise<boolean> {
  const setting = await db.appSetting.findUnique({ where: { id: 1 }, select: { registrationOpen: true } });
  return setting?.registrationOpen ?? true;
}

export async function setRegistrationOpen(value: boolean, adminUserId: number): Promise<void> {
  const before = await getRegistrationOpen();
  await db.appSetting.upsert({
    where: { id: 1 },
    update: { registrationOpen: value },
    create: { id: 1, registrationOpen: value },
  });
  await logAdminAction(
    adminUserId,
    value ? "ENABLE_REGISTRATION" : "DISABLE_REGISTRATION",
    "AppSetting",
    1,
    { registrationOpen: before },
    { registrationOpen: value }
  );
}

export async function getTournamentConcluded(): Promise<boolean> {
  const setting = await db.appSetting.findUnique({ where: { id: 1 }, select: { tournamentConcluded: true } });
  return setting?.tournamentConcluded ?? false;
}

export async function setTournamentConcluded(value: boolean, adminUserId: number): Promise<void> {
  const before = await getTournamentConcluded();
  await db.appSetting.upsert({
    where: { id: 1 },
    update: { tournamentConcluded: value },
    create: { id: 1, tournamentConcluded: value },
  });
  await logAdminAction(
    adminUserId,
    value ? "CONCLUDE_TOURNAMENT" : "REOPEN_TOURNAMENT",
    "AppSetting",
    1,
    { tournamentConcluded: before },
    { tournamentConcluded: value }
  );
}
