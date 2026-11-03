"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { setRegistrationOpen, setTournamentConcluded } from "@/lib/app-settings";

export async function setRegistrationOpenAction(value: boolean): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  await setRegistrationOpen(value, Number(admin.id));
  revalidatePath("/admin/impostazioni");
  return {};
}

export async function setTournamentConcludedAction(value: boolean): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  await setTournamentConcluded(value, Number(admin.id));
  revalidatePath("/admin/impostazioni");
  return {};
}
