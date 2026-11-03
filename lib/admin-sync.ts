export type AdminSyncAction =
  | "create"
  | "adopt"
  | "adopt-set-password-changed-at"
  | "rename-email"
  | "promote"
  | "rotate-password";

export type AdminSyncError = "multiple-managed" | "email-owned-by-other";

export type AdminSyncDecision =
  | { ok: true; actions: AdminSyncAction[] }
  | { ok: false; error: AdminSyncError };

export type AdminSyncInput = {
  managedCount: number;
  managed: {
    emailMatches: boolean;
    roleIsAdmin: boolean;
    credentialMatchesProvisioned: boolean;
  } | null;
  existingWithEnvEmail: {
    exists: boolean;
    isManaged: boolean;
    passwordMatches: boolean;
  };
};

export function decideAdminSync({
  managedCount,
  managed,
  existingWithEnvEmail,
}: AdminSyncInput): AdminSyncDecision {
  if (managedCount > 1) return { ok: false, error: "multiple-managed" };

  if (managedCount === 1) {
    if (!managed) return { ok: false, error: "multiple-managed" };

    if (!managed.emailMatches && existingWithEnvEmail.exists) {
      return { ok: false, error: "email-owned-by-other" };
    }

    const actions: AdminSyncAction[] = [];
    if (!managed.emailMatches) actions.push("rename-email");
    if (!managed.roleIsAdmin) actions.push("promote");
    if (!managed.credentialMatchesProvisioned) actions.push("rotate-password");
    return { ok: true, actions };
  }

  if (existingWithEnvEmail.exists) {
    const actions: AdminSyncAction[] = ["adopt"];
    if (!existingWithEnvEmail.passwordMatches) {
      actions.push("adopt-set-password-changed-at");
    }
    return { ok: true, actions };
  }

  return { ok: true, actions: ["create"] };
}
