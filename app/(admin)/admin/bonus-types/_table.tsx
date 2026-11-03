"use client";

import { useState, useEffect, useRef } from "react";
import { useActionState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { deleteBonusType, updateBonusType } from "@/app/actions/admin/bonus-types";
import ConfirmDeleteForm from "@/components/confirm-delete-form";
import { useAppToast } from "@/components/toast-provider";

type Row = { id: number; code: string; name: string; points: unknown; isSecret: boolean };

const PAGE_SIZE = 20;

export default function BonusTypesTable({ rows }: { rows: Row[] }) {
  const [page, setPage] = useState(0);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const total = rows.length;
  const start = page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="card overflow-hidden">
      {total === 0 ? (
        <p className="px-4 py-10 text-center over-label">Nessun tipo bonus.</p>
      ) : (
        <>
          {slice.map((row, idx) => {
            const pts = Number(row.points);
            const pointsBg = pts > 0 ? "#ECFDF5" : pts < 0 ? "#FEF2F2" : "var(--surface-2)";
            const pointsColor = pts > 0 ? "#065F46" : pts < 0 ? "#991B1B" : "var(--text-muted)";
            const ptsLabel = pts > 0 ? `+${pts}` : String(pts);
            return (
              <div
                key={row.id}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-1)] transition-colors"
                style={idx < slice.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : {}}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-black text-sm uppercase" style={{ color: "var(--text-primary)" }}>
                      {row.code}
                    </span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: pointsBg, color: pointsColor }}
                    >
                      {ptsLabel} pt
                    </span>
                    {row.isSecret && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1"
                        style={{ background: "rgba(232,160,0,0.14)", color: "#B77900" }}
                      >
                        <i className="pi pi-eye-slash text-[9px]" />
                        Segreto
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {row.name}
                  </div>
                </div>
                <Button
                  type="button"
                  icon="pi pi-pencil"
                  text
                  size="small"
                  aria-label="Modifica"
                  onClick={() => setEditRow(row)}
                />
                <ConfirmDeleteForm
                  action={deleteBonusType}
                  hiddenInputs={{ id: row.id }}
                  confirmMessage="Eliminare questo tipo bonus?"
                />
              </div>
            );
          })}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: "1px solid var(--border-soft)", background: "var(--surface-1)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {start + 1}–{Math.min(start + PAGE_SIZE, total)} di {total}
              </span>
              <div className="flex gap-1">
                <Button icon="pi pi-chevron-left" text size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Precedente" />
                <Button icon="pi pi-chevron-right" text size="small" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Successiva" />
              </div>
            </div>
          )}
        </>
      )}

      <EditBonusDialog key={editRow?.id ?? "closed"} row={editRow} onClose={() => setEditRow(null)} />
    </div>
  );
}

function EditBonusDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateBonusType, undefined);
  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [points, setPoints] = useState<number | null>(row ? Number(row.points) : 0);
  const [secret, setSecret] = useState(row?.isSecret ?? false);
  const { success, error } = useAppToast();
  const submitted = useRef(false);

  useEffect(() => {
    if (!submitted.current) return;
    if (state?.message) {
      error(state.message);
      submitted.current = false;
    } else if (state && !state.errors) {
      success("Tipo bonus aggiornato.");
      submitted.current = false;
      onClose();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!row) return null;

  return (
    <Dialog
      visible={!!row}
      onHide={onClose}
      closable={false}
      dismissableMask
      style={{ width: "min(28rem, 94vw)" }}
      pt={{
        root: { style: { borderRadius: "22px", overflow: "hidden" } },
        header: { className: "!hidden" },
        content: { className: "!p-0" },
      }}
      modal
      draggable={false}
      resizable={false}
      focusOnShow={false}
    >
      {/* Header */}
      <div
        className="relative overflow-hidden px-5 pb-5 pt-6 text-white"
        style={{ background: "linear-gradient(145deg, #0107A3 0%, #000669 100%)" }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(232,160,0,0.18)", border: "1px solid rgba(232,160,0,0.45)" }}
          >
            <i className="pi pi-pencil text-lg" style={{ color: "#E8A000" }} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[2px] text-white/55">Modifica</div>
            <h2 className="font-display text-xl font-black uppercase leading-none">Tipo bonus</h2>
          </div>
        </div>
      </div>

      <form action={action} onSubmit={() => { submitted.current = true; }} className="flex flex-col gap-4 p-5">
        <input type="hidden" name="id" value={row.id} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Codice *
            </label>
            <InputText name="code" value={code} onChange={(e) => setCode(e.target.value)} className="w-full uppercase" required />
            {state?.errors?.code && <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.code[0]}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Nome *
            </label>
            <InputText name="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full" required />
            {state?.errors?.name && <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.name[0]}</p>}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Punti * <span className="font-normal" style={{ color: "var(--text-muted)" }}>(negativo per i malus, es. -1)</span>
          </label>
          <input type="hidden" name="points" value={points ?? ""} />
          <InputNumber
            value={points}
            onValueChange={(e) => setPoints(e.value ?? null)}
            step={0.5}
            minFractionDigits={0}
            maxFractionDigits={2}
            placeholder="es. -1"
            className="w-full"
          />
          {state?.errors?.points && <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.points[0]}</p>}
        </div>

        {/* Segreto */}
        <input type="hidden" name="isSecret" value={secret ? "true" : "false"} />
        <button
          type="button"
          onClick={() => setSecret((v) => !v)}
          className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors"
          style={{
            borderColor: secret ? "rgba(232,160,0,0.45)" : "var(--border-soft)",
            background: secret ? "rgba(232,160,0,0.08)" : "#fff",
          }}
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: secret ? "#E8A000" : "var(--border-medium)",
              background: secret ? "#E8A000" : "#fff",
            }}
          >
            {secret && <i className="pi pi-check text-[11px]" style={{ color: "#06073D" }} />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Bonus segreto
            </span>
            <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
              Resta nascosto nella pagina Bonus Segreti finché non viene assegnato
            </span>
          </span>
        </button>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" label="Annulla" text size="small" onClick={onClose} disabled={pending} />
          <Button type="submit" label={pending ? "Salvo..." : "Salva"} icon="pi pi-check" size="small" disabled={pending} />
        </div>
      </form>
    </Dialog>
  );
}
