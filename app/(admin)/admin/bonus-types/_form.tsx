"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions/admin/football-teams";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { createBonusType } from "@/app/actions/admin/bonus-types";
import { useAppToast } from "@/components/toast-provider";

export default function NewBonusTypeForm() {
  const [state, setState] = useState<ActionResult | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [points, setPoints] = useState<number | null>(0);
  const [secret, setSecret] = useState(false);
  const { success, error } = useAppToast();

  function reset() {
    setCode("");
    setName("");
    setPoints(0);
    setSecret(false);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createBonusType(undefined, formData);
      setState(result);
      if (result?.message) {
        error(result.message);
      } else if (result && !result.errors) {
        success("Tipo bonus creato.");
        reset();
        setVisible(false);
      }
    });
  }

  return (
    <div className="flex justify-end">
      <Button
        type="button"
        label="Nuovo tipo bonus"
        icon="pi pi-plus"
        size="small"
        onClick={() => setVisible(true)}
      />

      <Dialog
        visible={visible}
        onHide={() => setVisible(false)}
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
              <i className="pi pi-star text-lg" style={{ color: "#E8A000" }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[2px] text-white/55">Nuovo</div>
              <h2 className="font-display text-xl font-black uppercase leading-none">Tipo bonus</h2>
            </div>
          </div>
        </div>

        <form action={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Codice *
              </label>
              <InputText
                name="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="es. GOAL"
                className="w-full uppercase"
                required
              />
              {state?.errors?.code && <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.code[0]}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Nome *
              </label>
              <InputText
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="es. Gol"
                className="w-full"
                required
              />
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
              placeholder="es. 3 oppure -1"
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
            <Button type="button" label="Annulla" text size="small" onClick={() => setVisible(false)} disabled={pending} />
            <Button type="submit" label={pending ? "Creo..." : "Crea bonus"} icon="pi pi-check" size="small" disabled={pending} />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
