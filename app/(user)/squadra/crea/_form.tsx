"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@/components/use-media-query";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { createFantasyTeam } from "@/app/actions/user/fantasy-teams";
import BackButton from "@/components/back-button";
import { getTeamCode, SLOT_ORDER } from "./_types";
import type { Player, PlayerGroup, SlotKey, SlotsState } from "./_types";
import SlotCard from "./_slot-card";
import PlayerSheet from "./_player-sheet";
import ShareStoryButton from "../_share-story-button";

type Validation = {
  count: number;
  gkOk: boolean;
  playerOk: boolean;
  teamsOk: boolean;
  captainOk: boolean;
  isValid: boolean;
};

function getMobileHint(v: Validation, teamName: string): string | null {
  if (v.isValid || v.count === 0) return null;
  if (v.count < 5) {
    const rem = 5 - v.count;
    return `Seleziona ancora ${rem} ${rem === 1 ? "giocatore" : "giocatori"}`;
  }
  if (!v.teamsOk) return "I giocatori devono essere di 5 squadre diverse";
  if (!teamName.trim()) return "Inserisci il nome della squadra";
  if (!v.captainOk) return "Tocca uno slot per scegliere il capitano";
  return null;
}

const SLOT_ROLE: Record<SlotKey, Player["role"]> = {
  goalkeeper: "P",
  topLeft: "A",
  topRight: "A",
  bottomLeft: "A",
  bottomRight: "A",
};

function createEmptySlots(): SlotsState {
  return {
    goalkeeper: null,
    topLeft: null,
    topRight: null,
    bottomLeft: null,
    bottomRight: null,
  };
}

export default function CreaSquadraForm({ players, tournamentAlreadyStarted }: { players: Player[]; tournamentAlreadyStarted?: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createFantasyTeam, undefined);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [slots, setSlots] = useState<SlotsState>(() => createEmptySlots());
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState("");
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [menuSlot, setMenuSlot] = useState<SlotKey | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [shareClosed, setShareClosed] = useState(false);
  const [rulesVisible, setRulesVisible] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const shareVisible = state?.success === true && !shareClosed;

  const selectedPlayers = useMemo(
    () =>
      SLOT_ORDER.map((k) => slots[k]).filter((p): p is Player => p !== null),
    [slots]
  );
  const selectedIds = useMemo(
    () => selectedPlayers.map((p) => p.id),
    [selectedPlayers]
  );

  const validation = useMemo(() => {
    const gkCount = selectedPlayers.filter((p) => p.role === "P").length;
    const playerCount = selectedPlayers.filter((p) => p.role === "A").length;
    const uniqueTeams = new Set(
      selectedPlayers.map((p) => p.footballTeam.id)
    ).size;
    const captainOk = captainId !== null && selectedIds.includes(captainId);
    return {
      count: selectedIds.length,
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
        teamName.trim().length >= 1,
    };
  }, [captainId, selectedIds, selectedPlayers, teamName]);

  const activePlayer = activeSlot ? slots[activeSlot] : null;
  const availablePlayers = useMemo(() => {
    if (!activeSlot) return [];
    const currentPlayerId = activePlayer?.id ?? null;
    const usedPlayerIds = new Set(
      selectedPlayers
        .filter((p) => p.id !== currentPlayerId)
        .map((p) => p.id)
    );
    const usedTeamIds = new Set(
      selectedPlayers
        .filter((p) => p.id !== currentPlayerId)
        .map((p) => p.footballTeam.id)
    );
    return players.filter(
      (p) =>
        p.role === SLOT_ROLE[activeSlot] &&
        !usedPlayerIds.has(p.id) &&
        !usedTeamIds.has(p.footballTeam.id)
    );
  }, [activePlayer?.id, activeSlot, players, selectedPlayers]);

  const availableGroups = useMemo(() => {
    const groups = new Map<number, PlayerGroup>();
    availablePlayers.forEach((p) => {
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
  }, [availablePlayers]);

  const menuPlayer = menuSlot ? slots[menuSlot] : null;
  const menuIsCaptain = menuPlayer ? captainId === menuPlayer.id : false;

  function handleConfermaClick() {
    if (!validation.isValid || pending) return;
    setConfirmVisible(true);
  }

  function handleConfirm() {
    setConfirmVisible(false);
    formRef.current?.requestSubmit();
  }

  function openSlot(slotKey: SlotKey) {
    if (pending) return;
    setMenuSlot(null);
    setActiveSlot(slotKey);
  }

  function assignPlayerToActiveSlot(player: Player) {
    if (!activeSlot) return;
    const replaced = slots[activeSlot];
    setSlots((prev) => ({ ...prev, [activeSlot]: player }));
    if (
      replaced &&
      replaced.id !== player.id &&
      captainId === replaced.id
    ) {
      setCaptainId(null);
    }
    setActiveSlot(null);
  }

  function clearSlot(slotKey: SlotKey) {
    const player = slots[slotKey];
    if (!player) return;
    setSlots((prev) => ({ ...prev, [slotKey]: null }));
    if (captainId === player.id) setCaptainId(null);
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="flex-1 flex flex-col overflow-hidden lg:flex-none lg:overflow-visible lg:gap-3"
    >
      {/* Header */}
      <div className="flex items-center px-4">
        <BackButton />
      </div>

      {/* Avviso torneo già iniziato — solo desktop (anche nel dialog di conferma) */}
      {tournamentAlreadyStarted && (
        <div
          className="hidden lg:flex items-start gap-3 rounded-2xl px-4 py-3"
          style={{
            background: "rgba(1,7,163,0.05)",
            border: "1px solid rgba(1,7,163,0.12)",
          }}
        >
          <i className="pi pi-info-circle mt-0.5 shrink-0 text-base" style={{ color: "var(--primary)" }} />
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Il torneo è già iniziato: le partite concluse prima della tua iscrizione non verranno conteggiate nel punteggio della tua squadra.
          </p>
        </div>
      )}

      {/* Mobile: nome squadra + link regole (sopra il campo) */}
      <div className="flex flex-col gap-2 px-4 pb-2 mt-6 lg:hidden">
        <InputText
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="w-full text-center"
          placeholder="Nome della tua squadra"
          maxLength={40}
        />
        <Button
          type="button"
          label="Come funziona il Fanta"
          icon="pi pi-question-circle"
          text
          size="small"
          onClick={() => setRulesVisible(true)}
          style={{ color: "var(--text-muted)", textTransform: "none", letterSpacing: "normal", fontSize: "12px" }}
          className="!pt-1 !pb-0 self-center gap-1.5 text-xs"
        />
      </div>

      {/* Campo + sidebar desktop */}
      <div className="flex-1 flex flex-col overflow-hidden lg:flex-none lg:overflow-visible lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-4">
        {/* Campo di gioco */}
        <div className="relative flex flex-col items-center justify-around py-12 flex-1">
          <img
            src="/images/football-field.webp"
            alt=""
            fetchPriority="high"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover"
          />

          {/* Top row — Giocatori 1 e 2 */}
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

          {/* Middle row — Giocatori 3 e 4 */}
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

          {/* Mobile overlay bottom: hint + conferma */}
          <div className="lg:hidden absolute bottom-8 inset-x-4 z-20 flex flex-col gap-2">
            {getMobileHint(validation, teamName) && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(251,191,36,0.92)", backdropFilter: "blur(4px)" }}>
                <i className="pi pi-info-circle shrink-0 text-sm text-amber-900" />
                <p className="text-xs font-medium text-amber-900">{getMobileHint(validation, teamName)}</p>
              </div>
            )}
            {state?.success === false && (
              <div aria-live="polite" className="flex flex-col items-center gap-0.5">
                {state.message && <p className="text-[11px] font-medium text-red-500 drop-shadow">{state.message}</p>}
                {state.errors?.name && <p className="text-[11px] font-medium text-red-500 drop-shadow">{state.errors.name[0]}</p>}
                {state.errors?.captainPlayerId && <p className="text-[11px] font-medium text-red-500 drop-shadow">{state.errors.captainPlayerId[0]}</p>}
              </div>
            )}
            <button
              type="button"
              disabled={!validation.isValid || pending}
              onClick={handleConfermaClick}
              className="w-full flex items-center justify-center py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--text-primary)" }}
            >
              {pending ? "Salvo..." : "Conferma squadra"}
            </button>
          </div>
        </div>

        {/* Sidebar desktop */}
        <div className="hidden lg:flex lg:flex-col lg:gap-4">
          <div className="card flex flex-col gap-4 p-4">
            {/* Nome squadra */}
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                Nome squadra *
              </label>
              <InputText
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full"
                placeholder="Inserisci il nome della tua squadra"
                maxLength={40}
              />
              {state?.success === false && state.errors?.name && (
                <p className="mt-1 text-sm text-red-500">
                  {state.errors.name[0]}
                </p>
              )}
            </div>

            {/* Riepilogo slot */}
            <div className="flex flex-col gap-2">
              {SLOT_ORDER.map((slotKey) => (
                <SlotSummaryRow
                  key={slotKey}
                  label={slotKey === "goalkeeper" ? "Portiere" : `Giocatore ${["topLeft","topRight","bottomLeft","bottomRight"].indexOf(slotKey) + 1}`}
                  player={slots[slotKey]}
                  onSelect={() => openSlot(slotKey)}
                  onClear={() => clearSlot(slotKey)}
                  disabled={pending}
                />
              ))}
            </div>

            {/* Capitano */}
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
                      {captainId === p.id ? "★ " : ""}({getTeamCode(p)}){" "}
                      {p.name}
                    </Button>
                  ))}
                </div>
                {state?.success === false && state.errors?.captainPlayerId && (
                  <p className="mt-2 text-sm text-red-500">
                    {state.errors.captainPlayerId[0]}
                  </p>
                )}
              </div>
            )}

            {/* Badge validazione */}
            <div className="flex flex-wrap gap-2">
              <StatusBadge ok={validation.gkOk} label="1 Portiere" />
              <StatusBadge ok={validation.playerOk} label="4 Giocatori" />
              <StatusBadge ok={validation.teamsOk} label="5 squadre diverse" />
              <StatusBadge ok={validation.captainOk} label="Capitano scelto" />
            </div>

            {/* Conferma desktop */}
            <Button
              type="button"
              label={pending ? "Salvo..." : "Conferma squadra"}
              disabled={!validation.isValid || pending}
              className="w-full"
              onClick={handleConfermaClick}
            />
          </div>
        </div>
      </div>

      {/* Hidden inputs per il form */}
      <input type="hidden" name="name" value={teamName} />
      <input type="hidden" name="captainPlayerId" value={captainId ?? ""} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="playerIds" value={id} />
      ))}

      {/* Dialog conferma squadra */}
      <Dialog
        visible={confirmVisible}
        onHide={() => setConfirmVisible(false)}
        closable={false}
        dismissableMask
        style={{ width: "min(26rem, 94vw)" }}
        pt={{
          root: { style: { borderRadius: "24px", overflow: "hidden" } },
          header: { className: "!hidden" },
          content: { className: "!p-0" },
        }}
        modal
        draggable={false}
        resizable={false}
      >
        <div>
          <div
            className="relative overflow-hidden px-5 pb-5 pt-6 text-white"
            style={{ background: "linear-gradient(145deg, #0107A3 0%, #000669 100%)" }}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -bottom-10 right-8 h-24 w-24 rounded-full border border-white/5" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "rgba(232,160,0,0.18)", border: "1px solid rgba(232,160,0,0.45)" }}>
                <i className="pi pi-lock text-lg" style={{ color: "#E8A000" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[2px] text-white/55">
                  Conferma definitiva
                </div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase leading-none">
                  {teamName.trim() || "La tua squadra"}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-white/65">
                  Dopo la conferma la rosa sarà bloccata e potrà essere modificata solo da un admin.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-1)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: "var(--text-muted)" }}>
                  Rosa selezionata
                </span>
                <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black" style={{ background: "rgba(1,7,163,0.08)", color: "var(--primary)" }}>
                  {selectedPlayers.length}/5
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {selectedPlayers.map((player) => {
                  const isCaptain = player.id === captainId;
                  return (
                    <div key={player.id} className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-black"
                        style={{
                          background: player.role === "P" ? "rgba(232,160,0,0.16)" : "rgba(1,7,163,0.08)",
                          color: player.role === "P" ? "#B77900" : "var(--primary)",
                        }}
                      >
                        {player.role === "P" ? "P" : "A"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {isCaptain && <span className="shrink-0 text-[10px]" style={{ color: "#E8A000" }}>★</span>}
                          <span className="truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {player.name}
                          </span>
                        </div>
                        <div className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {player.footballTeam.shortName ?? player.footballTeam.name}
                        </div>
                      </div>
                      {isCaptain && (
                        <span className="shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase" style={{ background: "rgba(232,160,0,0.14)", color: "#B77900" }}>
                          Capitano
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed" style={{ background: "rgba(232,160,0,0.10)", color: "var(--text-secondary)" }}>
              Controlla bene nomi, squadre e capitano. Questa scelta diventa definitiva appena premi conferma.
            </div>

            {tournamentAlreadyStarted && (
              <div
                className="flex items-start gap-3 rounded-2xl px-4 py-3"
                style={{
                  background: "rgba(1,7,163,0.05)",
                  border: "1px solid rgba(1,7,163,0.12)",
                }}
              >
                <i className="pi pi-info-circle mt-0.5 shrink-0 text-sm" style={{ color: "var(--primary)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Il torneo è già iniziato: le partite concluse prima della tua iscrizione non verranno conteggiate nel punteggio della tua squadra.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                label="Annulla"
                outlined
                className="w-full sm:flex-1"
                disabled={pending}
                onClick={() => setConfirmVisible(false)}
              />
              <Button
                type="button"
                label={pending ? "Salvo..." : "Conferma squadra"}
                icon={pending ? "pi pi-spin pi-spinner" : "pi pi-check"}
                className="w-full sm:flex-1"
                disabled={pending}
                onClick={handleConfirm}
                style={{ background: "#E8A000", borderColor: "#E8A000", color: "#06073D" }}
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Dialog condivisione Instagram post-creazione */}
      <Dialog
        visible={shareVisible}
        onHide={() => {
          setShareClosed(true);
          router.push("/squadra");
        }}
        closable={false}
        dismissableMask
        style={{ width: "320px" }}
        pt={{
          root: { style: { borderRadius: "20px", overflow: "hidden" } },
          header: { className: "!hidden" },
          content: { className: "!p-0" },
        }}
        modal
        draggable={false}
        resizable={false}
      >
        <div className="p-6">
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
              <i className="pi pi-check-circle text-2xl text-green-600" />
            </div>
            <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              Squadra creata!
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Condividi la tua squadra nelle storie di Instagram
            </p>
          </div>
          {state?.success === true && (
            <ShareStoryButton teamId={state.teamId} />
          )}
          <button
            type="button"
            onClick={() => {
              setShareClosed(true);
              router.push("/squadra");
            }}
            className="mt-3 w-full text-center text-sm font-medium transition-colors hover:text-[var(--primary)]"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            Vai alla squadra →
          </button>
        </div>
      </Dialog>

      {/* Menu contestuale slot pieno */}
      <Dialog
        visible={menuSlot !== null}
        onHide={() => setMenuSlot(null)}
        closable={false}
        dismissableMask
        style={{ width: "240px" }}
        pt={{
          root: { style: { borderRadius: "16px", overflow: "hidden" } },
          header: { className: "!hidden" },
          content: { className: "!p-0" },
        }}
        modal
        draggable={false}
        resizable={false}
      >
        {menuSlot && menuPlayer && (
          <div>
            {/* Player identity */}
            <div className="border-b border-[var(--border-soft)] px-4 pb-3 pt-4">
              <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[1.5px]" style={{ color: "#6466A3" }}>
                {getTeamCode(menuPlayer)}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-extrabold text-[var(--text-primary)]">
                  {menuPlayer.name}
                </span>
                {menuIsCaptain && (
                  <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                    ★ C
                  </span>
                )}
              </div>
            </div>

            {/* Azioni */}
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
              <div className="mx-4 border-t border-[var(--border-soft)] my-1" />
              <Button
                type="button"
                unstyled
                onClick={() => {
                  clearSlot(menuSlot);
                  setMenuSlot(null);
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-red-50"
              >
                <i className="pi pi-trash text-sm text-red-400" />
                <span className="text-sm font-semibold text-red-500">Rimuovi</span>
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Bottom sheet: regole del fanta */}
      <Dialog
        visible={rulesVisible}
        onHide={() => setRulesVisible(false)}
        closable={false}
        dismissableMask
        position={isMobile ? "bottom" : "center"}
        style={isMobile ? { width: "100%", margin: 0 } : { width: "min(28rem, 96vw)" }}
        pt={
          isMobile
            ? {
                root: { style: { borderRadius: "20px 20px 0 0", overflow: "hidden" } },
                header: { className: "!px-4 !py-0" },
                content: { className: "!border-t !border-[var(--border-soft)] !px-4 !pt-3 !pb-8" },
              }
            : {
                root: { style: { borderRadius: "22px", overflow: "hidden" } },
                header: { className: "!px-5 !py-0 !border-b !border-[var(--border-soft)]" },
                content: { className: "!px-5 !pt-3 !pb-6" },
              }
        }
        header={
          <div className="flex flex-col">
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full" style={{ background: "var(--border-medium)" }} />
              </div>
            )}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "var(--primary-light)" }}
                >
                  <i className="pi pi-star-fill text-sm" style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Guida rapida
                  </div>
                  <div className="text-[15px] font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
                    Come funziona il Fanta
                  </div>
                </div>
              </div>
              <Button
                type="button"
                icon="pi pi-times"
                text
                rounded
                severity="secondary"
                aria-label="Chiudi"
                onClick={() => setRulesVisible(false)}
              />
            </div>
          </div>
        }
        modal
        draggable={false}
        resizable={false}
        focusOnShow={false}
      >
        <div className="overflow-y-auto" style={{ maxHeight: isMobile ? "58vh" : "70vh" }}>
          <div
            className="overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border-soft)" }}
          >
            {[
              {
                icon: "pi-users",
                color: "var(--primary)",
                bg: "var(--primary-light)",
                title: "La tua rosa",
                text: "Scegli 1 portiere e 4 giocatori di movimento.",
              },
              {
                icon: "pi-shield",
                color: "#7C3AED",
                bg: "#F5F3FF",
                title: "Una squadra per slot",
                text: "Puoi prendere al massimo 1 giocatore per squadra. Quando selezioni un giocatore, la sua squadra sparisce dalle opzioni disponibili.",
              },
              {
                icon: "pi-lock",
                color: "#DC2626",
                bg: "#FEF2F2",
                title: "La rosa è definitiva",
                text: "Una volta confermata, la squadra non si può più modificare. Scegli con cura.",
              },
              {
                icon: "pi-bolt",
                color: "#D97706",
                bg: "#FFFBEB",
                title: "Punti e bonus segreti",
                text: "I punti non si assegnano solo per i goal. Ci sono bonus segreti per le giocate più spettacolari - sprona i tuoi giocatori a fare cose epiche.",
              },
              {
                icon: "pi-trophy",
                color: "#059669",
                bg: "#ECFDF5",
                title: "Vota l'MVP",
                text: "Dopo ogni partita puoi votare il tuo MVP. Non dimenticarti - è un modo concreto per fare punti.",
              },
            ].map((rule, i, arr) => (
              <div
                key={rule.title}
                className="flex items-start gap-4 px-5 py-5 bg-white"
                style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : undefined}
              >
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: rule.bg }}
                >
                  <i className={`pi ${rule.icon} text-sm`} style={{ color: rule.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold" style={{ color: "var(--text-primary)" }}>
                    {rule.title}
                  </div>
                  <div className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {rule.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Dialog>

      {/* Sheet selezione giocatore */}
      <PlayerSheet
        visible={activeSlot !== null}
        slotLabel={
          activeSlot
            ? activeSlot === "goalkeeper" ? "Seleziona portiere" : "Seleziona giocatore"
            : ""
        }
        availableGroups={availableGroups}
        currentPlayerId={activeSlot ? (slots[activeSlot]?.id ?? null) : null}
        onSelect={assignPlayerToActiveSlot}
        onHide={() => setActiveSlot(null)}
        isMobile={isMobile}
      />
    </form>
  );
}

function SlotSummaryRow({
  label,
  player,
  onSelect,
  onClear,
  disabled,
}: {
  label: string;
  player: Player | null;
  onSelect: () => void;
  onClear: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-white px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {label}
        </div>
        <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {player ? `(${getTeamCode(player)}) ${player.name}` : "Slot ancora libero"}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          label={player ? "Cambia" : "Scegli"}
          size="small"
          outlined
          disabled={disabled}
          onClick={onSelect}
        />
        {player && (
          <Button
            type="button"
            icon="pi pi-times"
            text
            rounded
            severity="secondary"
            aria-label={`Svuota ${label}`}
            disabled={disabled}
            onClick={onClear}
          />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? "" : "border border-amber-200 bg-amber-50 text-amber-700"
      }`}
      style={ok ? { background: "rgba(50,215,75,0.12)", color: "#32D74B" } : undefined}
    >
      {ok ? "✓ " : "○ "}
      {label}
    </span>
  );
}
