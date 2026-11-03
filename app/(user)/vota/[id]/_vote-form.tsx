"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { castVote } from "@/app/actions/user/vote";
import { resolveTeamFlag } from "@/lib/flags";

type Team = { id: number; name: string; countryCode: string | null; logoUrl: string | null };
type Player = { id: number; name: string; role: string; footballTeamId: number; footballTeam: Team };

function TeamLogo({ team, size = 24 }: { team: Team; size?: number }) {
  const src = resolveTeamFlag(team);
  if (!src) return null;
  return <img src={src} alt={team.name} style={{ width: size, height: size * 0.67, objectFit: "contain", borderRadius: 0 }} />;
}

function displayName(player: Player, allPlayers: Player[]) {
  const last = player.name.split(" ").at(-1)!;
  const hasDuplicate = allPlayers.some((p) => p.id !== player.id && p.name.split(" ").at(-1) === last);
  if (!hasDuplicate) return last;
  const initial = player.name[0];
  return `${initial}. ${last}`;
}

function SheetContent({
  homeTeam, awayTeam, outfield, goalkeepers,
  teamFilter, setTeamFilter, selectedPlayer, onSelect, onClose,
}: {
  homeTeam: Team | null; awayTeam: Team | null;
  outfield: Player[]; goalkeepers: Player[];
  teamFilter: number | null; setTeamFilter: (v: number | null) => void;
  selectedPlayer: Player | null; onSelect: (p: Player) => void; onClose: () => void;
}) {
  const allPlayers = [...outfield, ...goalkeepers];
  return (
    <>
      {/* Header */}
      <div className="flex items-center px-4 pt-6 pb-4 shrink-0">
        <p className="flex-1 text-center text-black" style={{ fontSize: 16, lineHeight: "26px" }}>
          Chi sarà il Player of the Match?
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center shrink-0"
          style={{ color: "rgba(9,20,76,0.4)" }}
          aria-label="Chiudi"
        >
          <i className="pi pi-times text-sm" />
        </button>
      </div>

      {/* Team filter pills */}
      {(homeTeam || awayTeam) && (
        <div className="flex gap-3 px-4 pb-10 justify-center flex-wrap shrink-0">
          {homeTeam && (
            <button
              type="button"
              onClick={() => setTeamFilter(teamFilter === homeTeam.id ? null : homeTeam.id)}
              className="flex items-center gap-2 px-3 rounded-full h-10 text-sm font-medium transition-colors"
              style={{
                border: `1.5px solid ${teamFilter === homeTeam.id ? "var(--primary)" : "rgba(9,20,76,0.12)"}`,
                color: teamFilter === homeTeam.id ? "var(--primary)" : "var(--text-primary)",
                background: teamFilter === homeTeam.id ? "rgba(9,20,76,0.04)" : "transparent",
              }}
            >
              <span className="flex items-center justify-center w-8 h-8">
                <TeamLogo team={homeTeam} size={24} />
              </span>
              {homeTeam.name}
            </button>
          )}
          {awayTeam && (
            <button
              type="button"
              onClick={() => setTeamFilter(teamFilter === awayTeam.id ? null : awayTeam.id)}
              className="flex items-center gap-2 px-3 rounded-full h-10 text-sm font-medium transition-colors"
              style={{
                border: `1.5px solid ${teamFilter === awayTeam.id ? "var(--primary)" : "rgba(9,20,76,0.12)"}`,
                color: teamFilter === awayTeam.id ? "var(--primary)" : "var(--text-primary)",
                background: teamFilter === awayTeam.id ? "rgba(9,20,76,0.04)" : "transparent",
              }}
            >
              <span className="flex items-center justify-center w-8 h-8">
                <TeamLogo team={awayTeam} size={24} />
              </span>
              {awayTeam.name}
            </button>
          )}
        </div>
      )}

      {/* Scrollable players */}
      <div className="overflow-y-auto flex-1 px-4 pb-10">
        {outfield.length > 0 && (
          <div className="mb-10">
            <p className="text-black mb-6" style={{ fontSize: 16, lineHeight: "26px" }}>Giocatori di movimento</p>
            <div className="grid grid-cols-3 gap-6">
              {outfield.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
                    <TeamLogo team={p.footballTeam} size={48} />
                    {selectedPlayer?.id === p.id && (
                      <i className="pi pi-star-fill absolute -top-1 -right-1" style={{ fontSize: 12, color: "#E8A000" }} />
                    )}
                  </div>
                  <span className="text-center leading-tight" style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: selectedPlayer?.id === p.id ? 700 : 400 }}>
                    {displayName(p, allPlayers)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {goalkeepers.length > 0 && (
          <div>
            <p className="text-black mb-6" style={{ fontSize: 16, lineHeight: "26px" }}>Portieri</p>
            <div className="grid grid-cols-3 gap-6">
              {goalkeepers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
                    <TeamLogo team={p.footballTeam} size={48} />
                    {selectedPlayer?.id === p.id && (
                      <i className="pi pi-star-fill absolute -top-1 -right-1" style={{ fontSize: 12, color: "#E8A000" }} />
                    )}
                  </div>
                  <span className="text-center leading-tight" style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: selectedPlayer?.id === p.id ? 700 : 400 }}>
                    {displayName(p, allPlayers)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function VoteForm({
  matchId, userVote, homeTeam, awayTeam, players,
}: {
  matchId: number;
  userVote: { playerName: string; team: { id?: number; countryCode: string | null; logoUrl: string | null; name: string } } | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  players: Player[];
}) {
  const [state, setState] = useState<{ success: boolean; message?: string } | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [teamFilter, setTeamFilter] = useState<number | null>(null);
  const openSheet = () => {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
  };

  const closeSheet = () => {
    setAnimIn(false);
    setTimeout(() => setMounted(false), 300);
  };

  const handleConfirm = () => {
    if (!selectedPlayer) return;
    const fd = new FormData();
    fd.set("matchId", String(matchId));
    fd.set("playerId", String(selectedPlayer.id));
    startTransition(async () => {
      const result = await castVote(undefined, fd);
      setState(result);
      if (result.success) router.push(`/partite/${matchId}`);
    });
  };

  const handleSelect = (p: Player) => {
    setSelectedPlayer(p);
    closeSheet();
  };

  const filteredPlayers = teamFilter ? players.filter((p) => p.footballTeamId === teamFilter) : players;
  const outfield = filteredPlayers.filter((p) => p.role !== "P");
  const goalkeepers = filteredPlayers.filter((p) => p.role === "P");

  const votedName = state?.success ? selectedPlayer?.name : userVote?.playerName;
  const votedTeam = state?.success ? selectedPlayer?.footballTeam : userVote?.team;

  const sheetProps = { homeTeam, awayTeam, outfield, goalkeepers, teamFilter, setTeamFilter, selectedPlayer, onSelect: handleSelect, onClose: closeSheet };

  return (
    <>
      {/* Selection card */}
      <div
        className="bg-white rounded-3xl p-6 flex flex-col items-center gap-4 text-center"
        style={{ border: "1px solid rgba(9,20,76,0.05)", boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)" }}
      >
        <p className="w-full text-center text-black" style={{ fontSize: 16, lineHeight: "26px" }}>
          Chi sarà il Player of the Match?
        </p>

        {selectedPlayer ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <TeamLogo team={selectedPlayer.footballTeam} size={48} />
              </div>
              <span className="text-sm font-semibold text-(--text-primary)">{selectedPlayer.name}</span>
              <button type="button" onClick={() => openSheet()} className="text-xs underline underline-offset-2" style={{ color: "rgba(0,0,0,0.4)" }}>
                Cambia
              </button>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="w-full flex items-center justify-center py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--text-primary)" }}
            >
              {pending ? "..." : "Conferma voto"}
            </button>
          </>
        ) : votedName ? (
          <div className="flex flex-col items-center gap-2">
            {votedTeam && (
              <div className="flex items-center justify-center" style={{ width: 56, height: 56 }}>
                <TeamLogo team={{ id: votedTeam.id ?? 0, ...votedTeam }} size={48} />
              </div>
            )}
            <span className="text-sm font-semibold text-(--text-primary)">{votedName}</span>
          </div>
        ) : (
          <button type="button" onClick={() => openSheet()} disabled={pending} className="flex flex-col items-center gap-2 disabled:opacity-40">
            <img src="/icons/add_circle.svg" width={48} height={48} alt="Aggiungi" />
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Seleziona giocatore</span>
          </button>
        )}

        {state?.success === false && <p className="text-xs text-red-500">{state.message}</p>}
      </div>

      {/* ── Overlay (mobile: bottom sheet, desktop: centered modal) ── */}
      {mounted && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(6,7,61,0.3)", opacity: animIn ? 1 : 0, transition: "opacity 0.3s ease" }}
            onClick={closeSheet}
          />
          {/* Mobile: bottom sheet */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white flex flex-col"
            style={{
              borderRadius: "24px 24px 0 0",
              height: "80svh",
              transform: animIn ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
            }}
          >
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} />
            </div>
            <SheetContent {...sheetProps} />
          </div>
          {/* Desktop: centered modal */}
          <div
            className="hidden md:flex fixed inset-0 z-50 items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) closeSheet(); }}
          >
            <div
              className="bg-white flex flex-col"
              style={{
                borderRadius: 24,
                width: "min(500px, 96vw)",
                maxHeight: "90vh",
                opacity: animIn ? 1 : 0,
                transform: animIn ? "scale(1)" : "scale(0.95)",
                transition: "opacity 0.25s ease, transform 0.25s ease",
              }}
            >
              <SheetContent {...sheetProps} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
