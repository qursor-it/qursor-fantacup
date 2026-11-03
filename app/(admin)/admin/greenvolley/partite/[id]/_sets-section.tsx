"use client";

import { useActionState, useState, useTransition } from "react";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useRouter } from "next/navigation";
import { useAppToast } from "@/components/toast-provider";
import {
  addVolleySet,
  updateVolleySet,
  deleteVolleySet,
  scheduleVolleyMatch,
  concludeVolleyMatch,
  reopenVolleyMatch,
} from "@/app/actions/admin/volley";

type SetRow = {
  id: number;
  setNumber: number;
  homePoints: number;
  awayPoints: number;
};

type MatchInfo = {
  id: number;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
  sets: SetRow[];
};

export default function SetSection({ match }: { match: MatchInfo }) {
  const router = useRouter();
  const { error: showError } = useAppToast();
  const [homePoints, setHomePoints] = useState<number | null>(null);
  const [awayPoints, setAwayPoints] = useState<number | null>(null);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editingHomePoints, setEditingHomePoints] = useState<number | null>(null);
  const [editingAwayPoints, setEditingAwayPoints] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addSetAction = addVolleySet.bind(null, match.id);
  const [addState, formAction, addPending] = useActionState(addSetAction, undefined);

  const isConcluded = match.status === "CONCLUDED";
  const canAddSet = !isConcluded && match.sets.length < 5;
  const canSaveEdit =
    editingSetId !== null &&
    editingHomePoints !== null &&
    editingAwayPoints !== null;

  function startEdit(set: SetRow) {
    if (isConcluded) return;
    setEditingSetId(set.id);
    setEditingHomePoints(set.homePoints);
    setEditingAwayPoints(set.awayPoints);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingSetId(null);
    setEditingHomePoints(null);
    setEditingAwayPoints(null);
    setEditError(null);
  }

  function handleSaveEdit() {
    if (!canSaveEdit || editingSetId === null) return;
    startTransition(async () => {
      const result = await updateVolleySet(
        editingSetId,
        match.id,
        editingHomePoints,
        editingAwayPoints
      );
      if (result?.error) {
        setEditError(result.error);
        return;
      }
      cancelEdit();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Set table */}
      <div className="admin-card overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="font-black text-base uppercase tracking-wide">Set</h2>
          <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
            {match.sets.length} / 5
          </span>
        </div>
        {!isConcluded && (
          <div className="px-4 pb-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Tocca un set per modificarlo.
          </div>
        )}
        {editError && (
          <div className="px-4 pb-2 text-sm font-semibold text-red-500">
            {editError}
          </div>
        )}
        <div className="md:hidden">
          {match.sets.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Nessun set registrato
            </p>
          ) : (
            match.sets.map((s, idx) => {
              const isEditing = !isConcluded && editingSetId === s.id;
              const homeWon = s.homePoints > s.awayPoints;
              const winnerName = homeWon ? match.homeTeamName : match.awayTeamName;

              return (
                <div
                  key={s.id}
                  role={!isConcluded && !isEditing ? "button" : undefined}
                  tabIndex={!isConcluded && !isEditing ? 0 : undefined}
                  className={`px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary-light)] ${
                    !isConcluded && !isEditing
                      ? "cursor-pointer transition-colors active:bg-[var(--surface-1)]"
                      : ""
                  }`}
                  style={idx < match.sets.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : undefined}
                  onClick={() => {
                    if (!isConcluded && !isEditing) startEdit(s);
                  }}
                  onKeyDown={(event) => {
                    if (!isConcluded && !isEditing && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      startEdit(s);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="over-label mb-1">Set {s.setNumber}</div>
                      {isEditing ? (
                        <div
                          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <label className="min-w-0 text-xs font-semibold">
                            <span className="mb-1 block truncate">{match.homeTeamName}</span>
                            <InputNumber
                              value={editingHomePoints}
                              onValueChange={(e) => setEditingHomePoints(e.value ?? null)}
                              min={0}
                              max={99}
                              className="w-full min-w-0"
                              inputClassName="!text-center"
                            />
                          </label>
                          <span className="pb-2 text-sm font-black" style={{ color: "var(--text-muted)" }}>
                            -
                          </span>
                          <label className="min-w-0 text-xs font-semibold">
                            <span className="mb-1 block truncate">{match.awayTeamName}</span>
                            <InputNumber
                              value={editingAwayPoints}
                              onValueChange={(e) => setEditingAwayPoints(e.value ?? null)}
                              min={0}
                              max={99}
                              className="w-full min-w-0"
                              inputClassName="!text-center"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-2xl font-black leading-none"
                            style={!homeWon ? { color: "var(--text-muted)" } : undefined}
                          >
                            {s.homePoints}
                          </span>
                          <span className="text-sm font-black" style={{ color: "var(--text-muted)" }}>
                            -
                          </span>
                          <span
                            className="text-2xl font-black leading-none"
                            style={homeWon ? { color: "var(--text-muted)" } : undefined}
                          >
                            {s.awayPoints}
                          </span>
                        </div>
                      )}
                    </div>

                    {!isConcluded && !isEditing && (
                      <Button
                        icon="pi pi-trash"
                        text
                        size="small"
                        severity="danger"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          startTransition(async () => {
                            await deleteVolleySet(s.id, match.id);
                            router.refresh();
                          });
                        }}
                        aria-label="Elimina set"
                      />
                    )}
                  </div>

                  {isEditing ? (
                    <div
                      className="mt-3 flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        icon="pi pi-check"
                        text
                        size="small"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleSaveEdit();
                        }}
                        disabled={!canSaveEdit}
                        loading={isPending}
                        aria-label="Salva set"
                      />
                      <Button
                        icon="pi pi-times"
                        text
                        size="small"
                        severity="secondary"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          cancelEdit();
                        }}
                        disabled={isPending}
                        aria-label="Annulla modifica set"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 flex items-start justify-between gap-3 text-xs">
                      <span className="font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                        Vincitore
                      </span>
                      <span className="min-w-0 text-right text-sm font-black leading-tight" style={{ color: "#28C900" }}>
                        {winnerName}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block">
          <DataTable
            value={match.sets}
            emptyMessage="Nessun set registrato"
            rowClassName={() => (!isConcluded ? "cursor-pointer" : "")}
            onRowClick={(event) => startEdit(event.data as SetRow)}
          >
            <Column field="setNumber" header="Set" style={{ width: "60px" }} />
            <Column
              header={match.homeTeamName}
              body={(s: SetRow) => (
                !isConcluded && editingSetId === s.id ? (
                  <InputNumber
                    value={editingHomePoints}
                    onValueChange={(e) => setEditingHomePoints(e.value ?? null)}
                    min={0}
                    max={99}
                    className="w-24"
                    inputClassName="!text-center"
                  />
                ) : (
                  <span className={s.homePoints > s.awayPoints ? "font-black" : ""}>
                    {s.homePoints}
                  </span>
                )
              )}
            />
            <Column
              header={match.awayTeamName}
              body={(s: SetRow) => (
                !isConcluded && editingSetId === s.id ? (
                  <InputNumber
                    value={editingAwayPoints}
                    onValueChange={(e) => setEditingAwayPoints(e.value ?? null)}
                    min={0}
                    max={99}
                    className="w-24"
                    inputClassName="!text-center"
                  />
                ) : (
                  <span className={s.awayPoints > s.homePoints ? "font-black" : ""}>
                    {s.awayPoints}
                  </span>
                )
              )}
            />
            <Column
              header="Vincitore"
              body={(s: SetRow) => (
                !isConcluded && editingSetId === s.id ? (
                  <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                    In modifica
                  </span>
                ) : (
                  <span style={{ color: "#0E3D2B", fontWeight: 700 }}>
                    {s.homePoints > s.awayPoints
                      ? match.homeTeamName
                      : match.awayTeamName}
                  </span>
                )
              )}
            />
            {!isConcluded && (
              <Column
                header=""
                style={{ width: "110px" }}
                body={(s: SetRow) => (
                  editingSetId === s.id ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        icon="pi pi-check"
                        text
                        size="small"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveEdit();
                        }}
                        disabled={!canSaveEdit}
                        loading={isPending}
                        aria-label="Salva set"
                      />
                      <Button
                        icon="pi pi-times"
                        text
                        size="small"
                        severity="secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        disabled={isPending}
                        aria-label="Annulla modifica set"
                      />
                    </div>
                  ) : (
                    <Button
                      icon="pi pi-trash"
                      text
                      size="small"
                      severity="danger"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startTransition(async () => {
                          await deleteVolleySet(s.id, match.id);
                          router.refresh();
                        });
                      }}
                      aria-label="Elimina set"
                    />
                  )
                )}
              />
            )}
          </DataTable>
        </div>
      </div>

      {/* Aggiungi set */}
      {canAddSet && (
        <div className="admin-card p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wide sm:mb-4">
            Aggiungi Set {match.sets.length + 1}
          </h3>
          <form action={formAction} className="flex flex-col gap-3">
            {addState?.error && (
              <p className="text-sm font-semibold" style={{ color: "var(--error, #dc2626)" }}>
                {addState.error}
              </p>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <label className="truncate text-xs font-semibold sm:text-sm">{match.homeTeamName}</label>
                <InputNumber
                  value={homePoints}
                  onValueChange={(e) => setHomePoints(e.value ?? null)}
                  min={0}
                  max={99}
                  placeholder="0"
                  className="w-full min-w-0"
                  inputClassName="!text-center"
                />
                <input type="hidden" name="homePoints" value={homePoints ?? ""} />
              </div>
              <span className="pb-2 text-lg font-black sm:text-xl" style={{ color: "var(--text-muted)" }}>
                -
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <label className="truncate text-xs font-semibold sm:text-sm">{match.awayTeamName}</label>
                <InputNumber
                  value={awayPoints}
                  onValueChange={(e) => setAwayPoints(e.value ?? null)}
                  min={0}
                  max={99}
                  placeholder="0"
                  className="w-full min-w-0"
                  inputClassName="!text-center"
                />
                <input type="hidden" name="awayPoints" value={awayPoints ?? ""} />
              </div>
            </div>
            <Button
              type="submit"
              label="Aggiungi set"
              loading={addPending}
              className="w-full sm:w-auto sm:self-start"
              style={{ background: "#0E3D2B", border: "none", color: "#fff" }}
            />
          </form>
        </div>
      )}

      {/* Azioni stato */}
      <div className="admin-card flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:gap-3">
        {match.status === "DRAFT" && (
          <Button
            label="Segna come programmata"
            icon="pi pi-calendar"
            className="w-full sm:w-auto"
            onClick={() =>
              startTransition(async () => {
                const result = await scheduleVolleyMatch(match.id);
                if (result?.error) showError(result.error);
                router.refresh();
              })
            }
            loading={isPending}
            outlined
            style={{ color: "#0E3D2B", borderColor: "#0E3D2B" }}
          />
        )}
        {match.status === "SCHEDULED" && match.sets.length > 0 && (
          <Button
            label="Segna come conclusa"
            icon="pi pi-check"
            className="w-full sm:w-auto"
            onClick={() =>
              startTransition(async () => {
                const result = await concludeVolleyMatch(match.id);
                if (result?.error) showError(result.error);
                router.refresh();
              })
            }
            loading={isPending}
            style={{ background: "#0E3D2B", border: "none", color: "#fff" }}
          />
        )}
        {match.status === "CONCLUDED" && (
          <Button
            label="Riapri partita"
            icon="pi pi-refresh"
            severity="warning"
            className="w-full sm:w-auto"
            onClick={() =>
              startTransition(async () => {
                const result = await reopenVolleyMatch(match.id);
                if (result?.error) showError(result.error);
                router.refresh();
              })
            }
            loading={isPending}
            outlined
          />
        )}
      </div>
    </div>
  );
}
