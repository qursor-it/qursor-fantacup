"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "@/components/use-media-query";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { updateMyFantasyRoster } from "@/app/actions/user/fantasy-teams";
import BackButton from "@/components/back-button";
import { getTeamCode, SLOT_ORDER } from "../crea/_types";
import type { Player, PlayerGroup, SlotKey, SlotsState } from "../crea/_types";
import SlotCard from "../crea/_slot-card";
import PlayerSheet from "../crea/_player-sheet";

const SLOT_META: Record<SlotKey, { label: string; role: Player["role"]; wrapperClassName: string }> = {
  goalkeeper: { label: "Portiere", role: "P", wrapperClassName: "left-1/2 top-[72%] -translate-x-1/2 -translate-y-1/2" },
  topLeft: { label: "Giocatore 1", role: "A", wrapperClassName: "left-[24%] top-[23%] -translate-x-1/2 -translate-y-1/2" },
  topRight: { label: "Giocatore 2", role: "A", wrapperClassName: "left-[76%] top-[23%] -translate-x-1/2 -translate-y-1/2" },
  bottomLeft: { label: "Giocatore 3", role: "A", wrapperClassName: "left-[24%] top-[49%] -translate-x-1/2 -translate-y-1/2" },
  bottomRight: { label: "Giocatore 4", role: "A", wrapperClassName: "left-[76%] top-[49%] -translate-x-1/2 -translate-y-1/2" },
};

function buildInitialSlots(roster: Player[]): SlotsState {
  const gk = roster.find((p) => p.role === "P") ?? null;
  const outfield = roster.filter((p) => p.role === "A");
  return {
    goalkeeper: gk,
    topLeft: outfield[0] ?? null,
    topRight: outfield[1] ?? null,
    bottomLeft: outfield[2] ?? null,
    bottomRight: outfield[3] ?? null,
  };
}

export default function ModificaSquadraForm({
  players,
  currentRoster,
  captainPlayerId,
  baselinePlayerIds,
  maxChanges,
}: {
  players: Player[];
  currentRoster: Player[];
  captainPlayerId: number;
  baselinePlayerIds: number[];
  maxChanges: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateMyFantasyRoster, undefined);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [slots, setSlots] = useState<SlotsState>(() => buildInitialSlots(currentRoster));
  const [captainId, setCaptainId] = useState<number | null>(captainPlayerId);
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [menuSlot, setMenuSlot] = useState<SlotKey | null>(null);


  useEffect(() => {
    if (state?.success === true) router.push("/dashboard");
  }, [state, router]);

  const selectedPlayers = useMemo(
    () => SLOT_ORDER.map((k) => slots[k]).filter((p): p is Player => p !== null),
    [slots]
  );
  const selectedIds = useMemo(() => selectedPlayers.map((p) => p.id), [selectedPlayers]);

  const baseline = useMemo(() => new Set(baselinePlayerIds), [baselinePlayerIds]);
  const changesUsed = useMemo(
    () => selectedIds.filter((id) => !baseline.has(id)).length,
    [selectedIds, baseline]
  );
  const changesLeft = maxChanges - changesUsed;
  const overLimit = changesUsed > maxChanges;

  const validation = useMemo(() => {
    const gkCount = selectedPlayers.filter((p) => p.role === "P").length;
    const playerCount = selectedPlayers.filter((p) => p.role === "A").length;
    const uniqueTeams = new Set(selectedPlayers.map((p) => p.footballTeam.id)).size;
    const captainOk = captainId !== null && selectedIds.includes(captainId);
    return {
      gkOk: gkCount === 1,
      playerOk: playerCount === 4,
      teamsOk: uniqueTeams === 5 && selectedIds.length === 5,
      captainOk,
      isValid:
        selectedIds.length === 5 &&
        gkCount === 1 &&
        playerCount === 4 &&
        uniqueTeams === 5 &&
        captainOk &&
        !overLimit,
    };
  }, [captainId, selectedIds, selectedPlayers, overLimit]);

  const activePlayer = activeSlot ? slots[activeSlot] : null;
  const availableGroups = useMemo(() => {
    if (!activeSlot) return [] as PlayerGroup[];
    const currentPlayerId = activePlayer?.id ?? null;
    const usedPlayerIds = new Set(selectedPlayers.filter((p) => p.id !== currentPlayerId).map((p) => p.id));
    const usedTeamIds = new Set(selectedPlayers.filter((p) => p.id !== currentPlayerId).map((p) => p.footballTeam.id));
    const available = players.filter(
      (p) => p.role === SLOT_META[activeSlot].role && !usedPlayerIds.has(p.id) && !usedTeamIds.has(p.footballTeam.id)
    );
    const groups = new Map<number, PlayerGroup>();
    available.forEach((p) => {
      const existing = groups.get(p.footballTeam.id);
      if (existing) {
        existing.players.push(p);
        return;
      }
      groups.set(p.footballTeam.id, {
        teamId: p.footballTeam.id,
        teamName: p.footballTeam.name,
        teamCode: getTeamCode(p),
        players: [p],
      });
    });
    return [...groups.values()];
  }, [activePlayer?.id, activeSlot, players, selectedPlayers]);

  const menuPlayer = menuSlot ? slots[menuSlot] : null;
  const menuIsCaptain = menuPlayer ? captainId === menuPlayer.id : false;

  function openSlot(slotKey: SlotKey) {
    if (pending) return;
    setMenuSlot(null);
    setActiveSlot(slotKey);
  }

  function assignPlayerToActiveSlot(player: Player) {
    if (!activeSlot) return;
    const replaced = slots[activeSlot];
    setSlots((prev) => ({ ...prev, [activeSlot]: player }));
    if (replaced && replaced.id !== player.id && captainId === replaced.id) {
      setCaptainId(null);
    }
    setActiveSlot(null);
  }

  return (
    <form action={action} className="flex-1 flex flex-col overflow-hidden lg:overflow-visible">
      {/* Header */}
      <div className="flex items-center px-4">
        <div className="w-16 shrink-0 flex items-center">
          <BackButton />
        </div>
        <span className="flex-1 text-center text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          Modifica rosa
        </span>
        <div className="w-16 shrink-0" />
      </div>

      {/* Banner cambi */}
      <div className="flex items-center justify-center mx-4" style={{ marginTop: 40, marginBottom: 24 }}>
        <div
          className="inline-flex items-center gap-2 rounded-full px-4"
          style={{
            height: 47,
            ...(overLimit
              ? { background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }
              : { background: "rgba(50,215,75,0.10)", border: "1px solid rgba(50,215,75,0.25)" }),
          }}
        >
          <i
            className={`pi ${overLimit ? "pi-exclamation-circle" : "pi-check-circle"} text-xs`}
            style={{ color: overLimit ? "#DC2626" : "#1A7F37" }}
          />
          <span className="text-xs font-semibold tabular-nums" style={{ color: overLimit ? "#DC2626" : "#1A7F37" }}>
            {Math.max(0, changesLeft)}/{maxChanges} cambi rimasti
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:grid lg:flex-none lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-4">
        {/* Campo di gioco */}
        <div className="relative flex flex-col items-center justify-around py-12 flex-1">
          <img
            src="/images/football-field.webp"
            alt=""
            fetchPriority="high"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover"
          />

          {/* Top row */}
          <div className="flex gap-8 items-end justify-center relative z-10">
            {(["topLeft", "topRight"] as const).map((slotKey) => {
              const player = slots[slotKey];
              return (
                <SlotCard
                  key={slotKey}
                  slotKey={slotKey}
                  player={player}
                  isCaptain={player !== null && captainId === player.id}
                  pending={pending}
                  onEmptyClick={() => openSlot(slotKey)}
                  onFilledClick={() => { if (!pending) setMenuSlot(slotKey); }}
                />
              );
            })}
          </div>

          {/* Middle row */}
          <div className="flex gap-16 items-end justify-center relative z-10">
            {(["bottomLeft", "bottomRight"] as const).map((slotKey) => {
              const player = slots[slotKey];
              return (
                <SlotCard
                  key={slotKey}
                  slotKey={slotKey}
                  player={player}
                  isCaptain={player !== null && captainId === player.id}
                  pending={pending}
                  onEmptyClick={() => openSlot(slotKey)}
                  onFilledClick={() => { if (!pending) setMenuSlot(slotKey); }}
                />
              );
            })}
          </div>

          {/* Portiere */}
          <div className="relative z-10">
            {(() => {
              const player = slots.goalkeeper;
              return (
                <SlotCard
                  slotKey="goalkeeper"
                  player={player}
                  isCaptain={player !== null && captainId === player.id}
                  pending={pending}
                  onEmptyClick={() => openSlot("goalkeeper")}
                  onFilledClick={() => { if (!pending) setMenuSlot("goalkeeper"); }}
                />
              );
            })()}
          </div>

          {/* Overlay mobile: errori + bottone salva */}
          <div className="lg:hidden absolute bottom-8 inset-x-4 z-20 flex flex-col gap-2">
            {overLimit && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(220,38,38,0.88)", backdropFilter: "blur(4px)" }}>
                <i className="pi pi-exclamation-triangle shrink-0 text-sm text-white" />
                <p className="text-xs font-medium text-white">Troppi cambi: max {maxChanges} {maxChanges === 1 ? "giocatore" : "giocatori"}</p>
              </div>
            )}
            {state?.success === false && state.message && (
              <p aria-live="polite" className="text-[11px] font-medium text-red-500 drop-shadow text-center">{state.message}</p>
            )}
            <button
              type="submit"
              disabled={!validation.isValid || pending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: "var(--text-primary)" }}
            >
              {pending ? "Salvo..." : "Salva modifiche"}
            </button>
          </div>
        </div>

        {/* Sidebar desktop */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4">
          <div className="card flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              {SLOT_ORDER.map((slotKey) => (
                <div key={slotKey} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-white px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      {SLOT_META[slotKey].label}
                    </div>
                    <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {slots[slotKey] ? `(${getTeamCode(slots[slotKey]!)}) ${slots[slotKey]!.name}` : "Slot libero"}
                    </div>
                  </div>
                  <Button type="button" label="Cambia" size="small" outlined disabled={pending} onClick={() => openSlot(slotKey)} />
                </div>
              ))}
            </div>

            {selectedPlayers.length > 0 && (
              <div>
                <div className="over-label mb-2">Capitano</div>
                <div className="flex flex-wrap gap-2">
                  {selectedPlayers.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      unstyled
                      onClick={() => setCaptainId(p.id)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        captainId === p.id
                          ? "border-yellow-400 bg-yellow-400 text-[var(--text-primary)] shadow-[0_4px_12px_rgba(232,160,0,0.25)]"
                          : "border-[var(--border-soft)] bg-white text-[var(--text-primary)] hover:bg-[var(--surface-1)]"
                      }`}
                    >
                      {captainId === p.id ? "★ " : ""}({getTeamCode(p)}) {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <StatusBadge ok={validation.gkOk} label="1 Portiere" />
              <StatusBadge ok={validation.playerOk} label="4 Giocatori" />
              <StatusBadge ok={validation.teamsOk} label="5 squadre diverse" />
              <StatusBadge ok={validation.captainOk} label="Capitano scelto" />
            </div>

            <Button type="submit" label={pending ? "Salvo..." : "Salva modifiche"} disabled={!validation.isValid || pending} className="w-full" />
          </div>
        </div>
      </div>

      {/* Hidden inputs */}
      <input type="hidden" name="captainPlayerId" value={captainId ?? ""} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="playerIds" value={id} />
      ))}

      {/* Menu contestuale slot pieno */}
      {menuSlot && menuPlayer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setMenuSlot(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(6,7,61,0.3)" }} />
          <div
            className="relative w-full max-w-xs overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
            style={{ boxShadow: "0 -4px 24px rgba(1,7,163,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border-soft)] px-4 pb-3 pt-4">
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color: "#6466A3" }}>
                {getTeamCode(menuPlayer)}
              </div>
              <span className="text-[15px] font-extrabold text-[var(--text-primary)]">{menuPlayer.name}</span>
            </div>
            <div className="py-1.5">
              <Button
                type="button"
                unstyled
                onClick={() => {
                  setCaptainId(menuIsCaptain ? null : menuPlayer.id);
                  setMenuSlot(null);
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-yellow-50"
              >
                <i className={`pi ${menuIsCaptain ? "pi-star" : "pi-star-fill"} text-sm text-yellow-600`} />
                <span className="text-sm font-semibold text-yellow-800">
                  {menuIsCaptain ? "Togli capitano" : "Nomina capitano"}
                </span>
              </Button>
              <Button
                type="button"
                unstyled
                onClick={() => openSlot(menuSlot)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-1)]"
              >
                <i className="pi pi-refresh text-sm text-[var(--text-secondary)]" />
                <span className="text-sm font-semibold text-[var(--text-primary)]">Cambia giocatore</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <PlayerSheet
        visible={activeSlot !== null}
        slotLabel={activeSlot ? `Seleziona ${SLOT_META[activeSlot].label.toLowerCase()}` : ""}
        availableGroups={availableGroups}
        currentPlayerId={activeSlot ? slots[activeSlot]?.id ?? null : null}
        onSelect={assignPlayerToActiveSlot}
        onHide={() => setActiveSlot(null)}
        isMobile={isMobile}
      />
    </form>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${ok ? "" : "border border-amber-200 bg-amber-50 text-amber-700"}`}
      style={ok ? { background: "rgba(50,215,75,0.12)", color: "#32D74B" } : undefined}
    >
      {ok ? "✓ " : "○ "}
      {label}
    </span>
  );
}
