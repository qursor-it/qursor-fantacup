export type AdminSyncAction = "create" | "promote" | "update-password";

export function decideAdminSync({
  exists,
  role,
  passwordMatches,
}: {
  exists: boolean;
  role: string;
  passwordMatches: boolean;
}): AdminSyncAction[] {
  if (!exists) return ["create"];

  const actions: AdminSyncAction[] = [];
  if (role !== "ADMIN") actions.push("promote");
  if (!passwordMatches) actions.push("update-password");
  return actions;
}
