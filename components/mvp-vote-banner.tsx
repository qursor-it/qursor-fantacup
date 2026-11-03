"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolveTeamFlag } from "@/lib/flags";
import { MATCH_TIME_ZONE } from "@/lib/domain/match";

type TeamInfo = {
  name: string;
  shortName: string | null;
  countryCode: string | null;
  logoUrl: string | null;
} | null;

type PendingVote = {
  matchId: number;
  title: string;
  concludedAt: Date | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  homeSeed: string | null;
  awaySeed: string | null;
};

function TeamFlag({ team }: { team: TeamInfo }) {
  if (!team) return <div style={{ width: 24, height: 16 }} />;
  const src = resolveTeamFlag(team);
  if (!src) {
    return (
      <span
        className="inline-flex items-center justify-center rounded text-[9px] font-black text-white"
        style={{ width: 24, height: 16, background: "var(--primary)", flexShrink: 0 }}
      >
        {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return <img src={src} alt={team.name} style={{ width: 24, height: 16, objectFit: "contain", flexShrink: 0 }} />;
}

function formatDateLabel(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "short", timeZone: MATCH_TIME_ZONE,
  });
}

function groupByDate(votes: PendingVote[]): { label: string; items: PendingVote[] }[] {
  const map = new Map<string, PendingVote[]>();
  for (const vote of votes) {
    const label = formatDateLabel(vote.concludedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(vote);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function MvpVoteBanner({ votes }: { votes: PendingVote[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const count = votes.length;
  const groups = groupByDate(votes);

  useEffect(() => {
    if (mounted) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mounted]);

  function openSheet() {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setAnimIn(true)));
  }

  function closeSheet() {
    setAnimIn(false);
    setTimeout(() => setMounted(false), 300);
  }

  function navigateTo(href: string) {
    setAnimIn(false);
    setTimeout(() => { setMounted(false); router.push(href); }, 300);
  }

  return (
    <>
      <section className="max-w-lg mx-auto w-full px-4 mt-10">
        <div
          className="flex flex-col gap-3 bg-white rounded-3xl p-6"
          style={{ border: "1px solid rgba(9,20,76,0.05)", boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)" }}
        >
          <p
            className="uppercase text-(--text-primary) text-base leading-8.5 font-medium"
            style={{ fontFamily: "var(--font-tallica)" }}
          >
            {count === 1 ? "Vota il tuo MVP" : "Vota i tuoi MVP"}
          </p>
          <p className="text-sm text-black font-normal">
            {count === 1
              ? "È aperta la votazione per una partita. Hai 2 ore dalla fine."
              : <>{"Hai "}<strong>{count}</strong>{" votazioni aperte."}<br />{"Vota il migliore in campo per ogni partita."}</>}
          </p>
          <button
            type="button"
            onClick={openSheet}
            className="flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--text-primary)" }}
          >
            {count === 1 ? "Vota ora" : "Vedi le partite"}
          </button>
        </div>
      </section>

      {mounted && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(6,7,61,0.3)", opacity: animIn ? 1 : 0, transition: "opacity 0.3s ease-out" }}
            onClick={closeSheet}
          />

          {/* Bottom sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white flex flex-col mx-auto"
            style={{
              borderRadius: "24px 24px 0 0",
              height: "80svh",
              maxWidth: 512,
              transform: animIn ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s ease-out",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-2 pb-6 shrink-0">
              <span className="text-base text-black">
                Partite
              </span>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Chiudi"
                className="flex items-center justify-end w-6 h-6 rounded-full hover:bg-(--surface-1) transition-colors"
              >
                <i className="pi pi-times text-sm" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-10">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col">
                  <p className="text-xs text-center mb-3 capitalize">
                    {group.label}
                  </p>
                  <div className="flex flex-col">
                    {group.items.map((vote, idx) => {
                      const homeName = vote.homeTeam?.shortName ?? vote.homeTeam?.name ?? vote.homeSeed ?? "TBD";
                      const awayName = vote.awayTeam?.shortName ?? vote.awayTeam?.name ?? vote.awaySeed ?? "TBD";
                      const scored = vote.homeScore !== null && vote.awayScore !== null;

                      return (
                        <button
                          key={vote.matchId}
                          type="button"
                          onClick={() => navigateTo(`/vota/${vote.matchId}`)}
                          className="relative flex items-center py-5 w-full"
                          style={idx < group.items.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : undefined}
                        >
                          <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {homeName}
                            </span>
                            <TeamFlag team={vote.homeTeam} />
                          </div>

                          <span
                            className="shrink-0 text-sm font-semibold tabular-nums mx-5"
                            style={{ color: "var(--text-primary)", minWidth: 32, textAlign: "center" }}
                          >
                            {scored ? `${vote.homeScore}-${vote.awayScore}` : "vs"}
                          </span>

                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <TeamFlag team={vote.awayTeam} />
                            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {awayName}
                            </span>
                          </div>

                          <i className="pi pi-chevron-right absolute right-0 text-xs" style={{ color: "var(--text-muted)" }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
