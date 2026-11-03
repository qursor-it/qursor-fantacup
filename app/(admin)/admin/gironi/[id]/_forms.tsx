"use client";

import { useActionState, useRef } from "react";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import ConfirmDialog from "@/components/confirm-dialog";
import { useState } from "react";
import { updateGroup, deleteGroup, addTeamToGroup, removeTeamFromGroup, setTeamQualified } from "@/app/actions/admin/groups";
import type { ActionResult } from "@/app/actions/admin/football-teams";

type Group = { id: number; name: string; slug: string; order: number };
type FootballTeam = { id: number; name: string; shortName: string | null };

/* ── Edit group ─────────────────────────────────────────────────── */
export function EditGroupForm({ group }: { group: Group }) {
  const [state, action, pending] = useActionState(updateGroup, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={group.id} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Nome *
          </label>
          <InputText name="name" defaultValue={group.name} className="w-full" required />
          {state?.errors?.name && (
            <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.name[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Slug *
          </label>
          <InputText name="slug" defaultValue={group.slug} maxLength={4} className="w-full uppercase" required />
          {state?.errors?.slug && (
            <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.slug[0]}</p>
          )}
        </div>
      </div>
      <div className="w-32">
        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Ordine</label>
        <InputText name="order" type="number" defaultValue={String(group.order)} className="w-full" />
      </div>
      {state?.message && <p className="text-xs" style={{ color: "#991B1B" }}>{state.message}</p>}
      {state && !state.errors && !state.message && (
        <p className="text-xs" style={{ color: "#065F46" }}>Salvato.</p>
      )}
      <div>
        <Button type="submit" label={pending ? "..." : "Salva"} disabled={pending} size="small" />
      </div>
    </form>
  );
}

/* ── Delete group ───────────────────────────────────────────────── */
export function DeleteGroupForm({ groupId }: { groupId: number }) {
  const [state, action, pending] = useActionState(
    (_prev: ActionResult | undefined, fd: FormData) => deleteGroup(fd),
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [visible, setVisible] = useState(false);

  return (
    <>
      <ConfirmDialog
        visible={visible}
        onHide={() => setVisible(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        message="Eliminare questo girone? Verranno rimosse anche tutte le squadre associate."
        severity="danger"
      />
      <form ref={formRef} action={action}>
        <input type="hidden" name="id" value={groupId} />
        {state?.message && <p className="text-xs mb-2" style={{ color: "#991B1B" }}>{state.message}</p>}
        <Button
          type="button"
          label={pending ? "..." : "Elimina girone"}
          disabled={pending}
          size="small"
          severity="danger"
          outlined
          onClick={() => setVisible(true)}
        />
      </form>
    </>
  );
}

/* ── Add team ───────────────────────────────────────────────────── */
export function AddTeamForm({ groupId, availableTeams }: { groupId: number; availableTeams: FootballTeam[] }) {
  const [state, action, pending] = useActionState(addTeamToGroup, undefined);
  const [teamId, setTeamId] = useState<number | null>(null);

  const options = availableTeams.map((t) => ({ label: t.name, value: t.id }));

  return (
    <form action={action} className="flex gap-2 items-end">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="footballTeamId" value={teamId ?? ""} />
      <div className="flex-1">
        <Dropdown
          options={options}
          value={teamId}
          onChange={(e) => setTeamId(e.value)}
          placeholder="Seleziona squadra"
          className="w-full"
          filter
        />
      </div>
      {state?.message && <p className="text-xs" style={{ color: "#991B1B" }}>{state.message}</p>}
      <Button
        type="submit"
        label={pending ? "..." : "Aggiungi"}
        disabled={pending || !teamId}
        size="small"
        icon="pi pi-plus"
      />
    </form>
  );
}

/* ── Remove team ────────────────────────────────────────────────── */
export function RemoveTeamForm({ groupId, footballTeamId }: { groupId: number; footballTeamId: number }) {
  const [state, action, pending] = useActionState(
    (_prev: ActionResult | undefined, fd: FormData) => removeTeamFromGroup(fd),
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [visible, setVisible] = useState(false);

  return (
    <>
      <ConfirmDialog
        visible={visible}
        onHide={() => setVisible(false)}
        onConfirm={() => formRef.current?.requestSubmit()}
        message="Rimuovere questa squadra dal girone?"
        severity="danger"
      />
      <form ref={formRef} action={action}>
        <input type="hidden" name="groupId" value={groupId} />
        <input type="hidden" name="footballTeamId" value={footballTeamId} />
        <button
          type="button"
          disabled={pending}
          onClick={() => setVisible(true)}
          className="text-[11px] font-bold px-2 py-0.5 rounded transition-colors"
          style={{ color: "#991B1B", background: "#FEF2F2" }}
        >
          {pending ? "..." : "Rimuovi"}
        </button>
        {state?.message && <span className="ml-1 text-[11px]" style={{ color: "#991B1B" }}>{state.message}</span>}
      </form>
    </>
  );
}

/* ── Toggle qualified ───────────────────────────────────────────── */
export function ToggleQualifiedForm({ groupId, footballTeamId, qualified }: { groupId: number; footballTeamId: number; qualified: boolean }) {
  const [state, action, pending] = useActionState(
    (_prev: ActionResult | undefined, fd: FormData) => setTeamQualified(fd),
    undefined
  );
  return (
    <form action={action}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="footballTeamId" value={footballTeamId} />
      <input type="hidden" name="qualified" value={String(!qualified)} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors"
        style={
          qualified
            ? { background: "#ECFDF5", color: "#065F46" }
            : { background: "var(--surface-2)", color: "var(--text-muted)" }
        }
      >
        {pending ? "..." : qualified ? "✓ Qualificata" : "Qualifica"}
      </button>
      {state?.message && <span className="ml-1 text-[11px]" style={{ color: "#991B1B" }}>{state.message}</span>}
    </form>
  );
}
