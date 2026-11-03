import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";

type AppSettings = {
  registrationOpen: boolean;
  tournamentConcluded: boolean;
};

const CACHE_TTL_MS = 15_000;

// shortcut: per-process cache with 15s TTL, other instances see changes after up to 15s; move to a shared cache if the app runs on several instances
let cachedSettings: { value: AppSettings; expiresAt: number } | null = null;

export function invalidateAppSettingsCache(): void {
  cachedSettings = null;
}

const loadAppSettings = cache(async (): Promise<AppSettings> => {
  const now = Date.now();
  if (cachedSettings && now < cachedSettings.expiresAt) return cachedSettings.value;
  const setting = await db.appSetting.findUnique({
    where: { id: 1 },
    select: { registrationOpen: true, tournamentConcluded: true },
  });
  const value: AppSettings = {
    registrationOpen: setting?.registrationOpen ?? true,
    tournamentConcluded: setting?.tournamentConcluded ?? false,
  };
  cachedSettings = { value, expiresAt: now + CACHE_TTL_MS };
  return value;
});

export async function getRegistrationOpen(): Promise<boolean> {
  return (await loadAppSettings()).registrationOpen;
}

export async function setRegistrationOpen(value: boolean, adminUserId: number): Promise<void> {
  const before = await getRegistrationOpen();
  await db.appSetting.upsert({
    where: { id: 1 },
    update: { registrationOpen: value },
    create: { id: 1, registrationOpen: value },
  });
  invalidateAppSettingsCache();
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
  return (await loadAppSettings()).tournamentConcluded;
}

export async function setTournamentConcluded(value: boolean, adminUserId: number): Promise<void> {
  const before = await getTournamentConcluded();
  await db.appSetting.upsert({
    where: { id: 1 },
    update: { tournamentConcluded: value },
    create: { id: 1, tournamentConcluded: value },
  });
  invalidateAppSettingsCache();
  await logAdminAction(
    adminUserId,
    value ? "CONCLUDE_TOURNAMENT" : "REOPEN_TOURNAMENT",
    "AppSetting",
    1,
    { tournamentConcluded: before },
    { tournamentConcluded: value }
  );
}
