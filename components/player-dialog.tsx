"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { resolveTeamFlag } from "@/lib/flags";
import type { PublicPlayerGridRow } from "@/lib/data/public/players";

function Flag({ countryCode, logoUrl, name }: { countryCode: string | null; logoUrl?: string | null; name: string }) {
  const src = resolveTeamFlag({ countryCode, logoUrl: logoUrl ?? null });
  if (!src) return null;
  return <img src={src} alt={name} className="shrink-0 object-cover" style={{ width: 24, height: 16 }} />;
}

function fmtPts(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export default function PlayerDialog({ player, onHide }: { player: PublicPlayerGridRow; onHide: () => void }) {
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(() => Math.max(0, player.matchStats.length - 1));
  const [animIn, setAnimIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    setAnimIn(false);
    setTimeout(onHide, 300);
  };

  const handleNavigate = (href: string) => {
    setAnimIn(false);
    setTimeout(() => { onHide(); router.push(href); }, 300);
  };

  const selectedMatch = player.matchStats[selectedMatchIdx] ?? player.matchStats[0] ?? null;

  const matchGroups = player.matchStats.reduce<
    Array<{ phase: string; matches: Array<(typeof player.matchStats)[number] & { idx: number }> }>
  >((acc, match, idx) => {
    const phase = match.phase ?? "—";
    const existing = acc.find((g) => g.phase === phase);
    if (existing) {
      existing.matches.push({ ...match, idx });
    } else {
      acc.push({ phase, matches: [{ ...match, idx }] });
    }
    return acc;
  }, []);

  const teamFlagSrc = resolveTeamFlag(player.footballTeam);

  const content = (
    <>
      {/* ── X button ── */}
      <div className="flex justify-end px-5 pt-4 shrink-0">
        <button
          type="button"
          onClick={handleClose}
          className="w-6 h-6 flex items-center justify-center"
          style={{ color: "rgba(9,20,76,0.4)" }}
          aria-label="Chiudi"
        >
          <i className="pi pi-times text-sm" />
        </button>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center gap-6 px-5 pt-2 pb-4 shrink-0" style={{ borderBottom: "1px solid rgba(9,20,76,0.07)" }}>
        <img src="/icons/user-player.svg" alt="player" className="w-14 h-14 object-contain shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="font-semibold text-black" style={{ fontSize: 20, lineHeight: "24px" }}>{player.name}</div>
          <div className="flex items-center gap-2">
            {teamFlagSrc && (
              <img src={teamFlagSrc} alt={player.footballTeam.name} className="object-cover shrink-0" style={{ width: 24, height: 16 }} />
            )}
            <span className="text-sm text-black">{player.footballTeam.name}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto flex-1 pb-10 pt-8">
        {/* Stats strip */}
        <div className="mx-4 mb-6">
          <div className="grid grid-cols-3 rounded-3xl overflow-hidden" style={{ border: "1px solid rgba(9,20,76,0.1)" }}>
            {[
              { label: "Selezionato da", value: Math.round(player.pickRate) + "%", suffix: null },
              { label: "Goal", value: player.totalGoals, suffix: null },
              { label: "Punti fanta", value: fmtPts(player.totalBonusPoints), suffix: "pti" },
            ].map(({ label, value, suffix }, i) => (
              <div
                key={label}
                className="flex flex-col items-center py-4 gap-2"
                style={i < 2 ? { borderRight: "1px solid rgba(9,20,76,0.1)" } : undefined}
              >
                <span className="text-[10px]" style={{ color: "rgba(0,0,0,0.45)" }}>{label}</span>
                <span className="font-semibold text-base text-black">
                  {value}
                  {suffix && <span className="font-normal text-xs"> {suffix}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Match carousel ── */}
        {player.matchStats.length === 0 ? (
          <p className="px-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>
            Nessuna partita giocata.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <div className="flex px-4 gap-3 min-w-max pb-2">
                {matchGroups.map(({ phase, matches }) => (
                  <div key={phase} className="flex flex-col gap-2">
                    <span className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>{phase}</span>
                    <div className="flex gap-2">
                      {matches.map(({ idx, opponent, opponentCountryCode, matchBonusPoints }) => {
                        const isSelected = selectedMatchIdx === idx;
                        const flagSrc = opponentCountryCode
                          ? resolveTeamFlag({ countryCode: opponentCountryCode, logoUrl: null })
                          : null;
                        return (
                          <button
                            key={idx}
                            ref={
                              isSelected
                                ? (el) => {
                                    if (el && el.offsetParent !== null) {
                                      el.scrollIntoView({ block: "nearest", inline: "end" });
                                    }
                                  }
                                : undefined
                            }
                            type="button"
                            onClick={() => setSelectedMatchIdx(idx)}
                            className="flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
                            style={{
                              width: 96,
                              paddingTop: 8,
                              paddingBottom: 8,
                              paddingLeft: 24,
                              paddingRight: 24,
                              scrollMarginInlineEnd: 16,
                              background: isSelected ? "rgba(1,7,163,0.07)" : "transparent",
                              border: isSelected ? "1px solid transparent" : "1px solid rgba(9,20,76,0.05)",
                            }}
                          >
                            <span className="text-[10px]" style={{ color: "rgba(0,0,0,0.35)" }}>vs</span>
                            {flagSrc ? (
                              <img
                                src={flagSrc}
                                alt={opponent}
                                className="object-cover shrink-0"
                                style={{ width: 40, height: 26.667 }}
                              />
                            ) : (
                              <div
                                className="flex items-center justify-center text-[10px] font-bold"
                                style={{ width: 40, height: 26.667, background: "var(--surface-1)", color: "var(--text-muted)" }}
                              >
                                {opponent.slice(0, 3).toUpperCase()}
                              </div>
                            )}
                            <span
                              className="text-[10px] font-semibold text-white"
                              style={{ background: "#09144c", borderRadius: 4, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}
                            >
                              {fmtPts(matchBonusPoints)} pti
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Selected match detail ── */}
            {selectedMatch && (
              <div className="mt-6" style={{ borderTop: "1px solid rgba(9,20,76,0.08)" }}>
                <button type="button" onClick={() => handleNavigate(`/mvp/${selectedMatch.matchId}`)} className="relative flex items-center gap-5 px-4 py-6 w-full text-left">
                  <div className="flex-1 flex items-center justify-end gap-3 min-w-0">
                    <span className={`text-sm text-black truncate ${selectedMatch.isHome ? "font-semibold" : ""}`}>
                      {selectedMatch.isHome
                        ? (player.footballTeam.shortName ?? player.footballTeam.name)
                        : selectedMatch.opponent}
                    </span>
                    <Flag
                      countryCode={selectedMatch.isHome ? player.footballTeam.countryCode : selectedMatch.opponentCountryCode}
                      logoUrl={selectedMatch.isHome ? player.footballTeam.logoUrl : null}
                      name={selectedMatch.isHome ? player.footballTeam.name : selectedMatch.opponent}
                    />
                  </div>
                  <span className="text-sm text-black tabular-nums shrink-0">
                    {selectedMatch.hs !== null && selectedMatch.as_ !== null ? (
                      selectedMatch.isHome ? (
                        <>
                          <span className="font-semibold">{selectedMatch.hs}</span>-<span className="font-normal">{selectedMatch.as_}</span>
                        </>
                      ) : (
                        <>
                          <span className="font-normal">{selectedMatch.as_}</span>-<span className="font-semibold">{selectedMatch.hs}</span>
                        </>
                      )
                    ) : (
                      "–"
                    )}
                  </span>
                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <Flag
                      countryCode={selectedMatch.isHome ? selectedMatch.opponentCountryCode : player.footballTeam.countryCode}
                      logoUrl={selectedMatch.isHome ? null : player.footballTeam.logoUrl}
                      name={selectedMatch.isHome ? selectedMatch.opponent : player.footballTeam.name}
                    />
                    <span className={`text-sm text-black truncate ${selectedMatch.isHome ? "" : "font-semibold"}`}>
                      {selectedMatch.isHome
                        ? selectedMatch.opponent
                        : (player.footballTeam.shortName ?? player.footballTeam.name)}
                    </span>
                  </div>
                  <i className="pi pi-chevron-right absolute right-4 text-xs" style={{ color: "rgba(9,20,76,0.3)" }} />
                </button>

                <div className="flex flex-col px-4">
                  {selectedMatch.bonuses.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                      Nessun bonus in questa partita.
                    </p>
                  ) : (
                    <>
                      {selectedMatch.bonuses.map((bonus, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-4"
                          style={{ borderTop: "1px solid rgba(9,20,76,0.08)" }}
                        >
                          <span className="text-sm text-black flex-1 min-w-0">
                            {bonus.name}
                            {bonus.quantity > 1 && (
                              <span style={{ color: "rgba(0,0,0,0.4)" }}> ×{bonus.quantity}</span>
                            )}
                          </span>
                          <span className="text-sm font-semibold text-black tabular-nums shrink-0">
                            {fmtPts(bonus.points)}<span className="font-normal text-xs"> pti</span>
                          </span>
                        </div>
                      ))}
                      <div
                        className="flex items-center gap-3 py-4"
                        style={{ borderTop: "1px solid rgba(9,20,76,0.08)" }}
                      >
                        <span className="text-sm font-semibold uppercase text-black flex-1">Totale</span>
                        <span className="text-sm font-semibold text-black tabular-nums shrink-0">
                          {fmtPts(selectedMatch.matchBonusPoints)}<span className="font-normal text-xs"> pti</span>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-9998"
        style={{ background: "rgba(6,7,61,0.3)", opacity: animIn ? 1 : 0, transition: "opacity 0.3s ease" }}
        onClick={handleClose}
      />

      {/* Mobile: bottom sheet */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-9999 bg-white flex flex-col"
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
        {content}
      </div>

      {/* Desktop: centered modal */}
      <div
        className="hidden md:flex fixed inset-0 z-9999 items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
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
          {content}
        </div>
      </div>
    </>,
    document.body
  );
}
