"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import ConfirmDialog from "@/components/confirm-dialog";
import DeleteAccountDialog from "@/components/delete-account-dialog";
import { suspendUser, unsuspendUser, promoteToAdmin, demoteToUser, adminDeleteUser } from "@/app/actions/admin/users";
import type { ActionResult } from "@/app/actions/admin/football-teams";

const USER_ACTIONS = {
  suspend: suspendUser,
  unsuspend: unsuspendUser,
  promote: promoteToAdmin,
  demote: demoteToUser,
} as const;

/** Un solo stato per tutte le azioni: mostra il messaggio dell'ultima eseguita. */
async function runUserAction(_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> {
  const intent = String(fd.get("intent") ?? "");
  if (!Object.hasOwn(USER_ACTIONS, intent)) return { message: "Azione non valida." };
  return USER_ACTIONS[intent as keyof typeof USER_ACTIONS](fd);
}

export default function UserActionsForm({
  userId,
  isSuspended,
  isAdmin,
  userEmail,
}: {
  userId: number;
  isSuspended: boolean;
  isAdmin: boolean;
  userEmail: string;
}) {
  const router = useRouter();
  const suspendFormRef = useRef<HTMLFormElement>(null);
  const demoteFormRef = useRef<HTMLFormElement>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [state, userAction] = useActionState(runUserAction, undefined);
  const errorMessage = state?.message;

  const [dialog, setDialog] = useState<{
    visible: boolean;
    message: string;
    confirmLabel: string;
    severity: "danger" | "warning";
    onConfirm: () => void;
  }>({ visible: false, message: "", confirmLabel: "Sì, confermo", severity: "danger", onConfirm: () => {} });

  const hide = () => setDialog((d) => ({ ...d, visible: false }));

  const handleDeleteConfirm = async () => {
    const fd = new FormData();
    fd.append("userId", String(userId));
    const result = await adminDeleteUser(undefined, fd);
    if (result.error) return { error: result.error };
    router.push("/admin/utenti");
    return {};
  };

  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmDialog
        visible={dialog.visible}
        onHide={hide}
        onConfirm={dialog.onConfirm}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        severity={dialog.severity}
      />

      <DeleteAccountDialog
        visible={deleteVisible}
        onHide={() => setDeleteVisible(false)}
        onConfirm={handleDeleteConfirm}
        description={`Eliminare definitivamente l'account di ${userEmail}? Questa azione è irreversibile.`}
        requirePassword={false}
      />

      {/* Promozione / Retrocessione ruolo */}
      {isAdmin ? (
        <form ref={demoteFormRef} action={userAction}>
          <input type="hidden" name="intent" value="demote" />
          <input type="hidden" name="userId" value={userId} />
          <Button
            type="button"
            label="Rimuovi admin"
            icon="pi pi-user-minus"
            severity="warning"
            onClick={() =>
              setDialog({
                visible: true,
                message: "Rimuovere i privilegi admin da questo utente?",
                confirmLabel: "Sì, rimuovi",
                severity: "warning",
                onConfirm: () => demoteFormRef.current?.requestSubmit(),
              })
            }
          />
        </form>
      ) : (
        <form action={userAction}>
          <input type="hidden" name="intent" value="promote" />
          <input type="hidden" name="userId" value={userId} />
          <Button
            type="submit"
            label="Promuovi ad admin"
            icon="pi pi-user-plus"
          />
        </form>
      )}

      {/* Sospensione */}
      {isSuspended ? (
        <form action={userAction}>
          <input type="hidden" name="intent" value="unsuspend" />
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" label="Riattiva utente" severity="secondary" icon="pi pi-check" />
        </form>
      ) : (
        <form ref={suspendFormRef} action={userAction}>
          <input type="hidden" name="intent" value="suspend" />
          <input type="hidden" name="userId" value={userId} />
          <Button
            type="button"
            label="Sospendi utente"
            severity="danger"
            icon="pi pi-ban"
            onClick={() =>
              setDialog({
                visible: true,
                message: "Sospendere questo utente? Non potrà più accedere fino alla riattivazione.",
                confirmLabel: "Sì, sospendi",
                severity: "danger",
                onConfirm: () => suspendFormRef.current?.requestSubmit(),
              })
            }
          />
        </form>
      )}

      {/* Eliminazione — solo utenti non admin */}
      {!isAdmin && (
        <Button
          type="button"
          label="Elimina utente"
          severity="danger"
          outlined
          icon="pi pi-trash"
          onClick={() => setDeleteVisible(true)}
        />
      )}

      {errorMessage && (
        <p className="w-full text-sm" style={{ color: "#991B1B" }}>{errorMessage}</p>
      )}
    </div>
  );
}
