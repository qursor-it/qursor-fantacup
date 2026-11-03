"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppToast } from "@/components/toast-provider";
import { resolveTeamFlag } from "@/lib/flags";
import type { PublicMatchRow } from "@/lib/data/public/matches";

function TeamFlag({ team }: { team: PublicMatchRow["homeTeam"] }) {
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

function groupMatchesByDate(matches: PublicMatchRow[]) {
  const map = new Map<string, PublicMatchRow[]>();
  for (const m of matches) {
    const label = m.startsAt.toLocaleDateString("it-IT", {
      weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
    });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(m);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export default function SquadraMenu({
  teamId,
  matches = [],
  editWindowOpen = false,
}: {
  teamId?: number;
  matches?: PublicMatchRow[];
  editWindowOpen?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [sheetAnimIn, setSheetAnimIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const { error: showError, success: showSuccess, info: showInfo } = useAppToast();

  const isAnyOpen = menuOpen || sheetMounted;

  // Blocca scroll quando menu o sheet sono aperti
  useEffect(() => {
    document.body.style.overflow = isAnyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isAnyOpen]);

  function openSheet() {
    setMenuOpen(false);
    setSheetMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setSheetAnimIn(true)));
  }

  function closeSheet() {
    setSheetAnimIn(false);
    setTimeout(() => setSheetMounted(false), 300);
  }

  function navigateTo(href: string) {
    setSheetAnimIn(false);
    setTimeout(() => { setSheetMounted(false); router.push(href); }, 300);
  }

  async function handleShare() {
    if (!teamId) return;
    setLoading(true);
    setMenuOpen(false);
    const dismissInfo = showInfo("Stiamo generando l'immagine da condividere...");
    try {
      const res = await fetch(`/api/story/${teamId}`);
      dismissInfo();
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], "squadra-dcup.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); return; }
        catch (err) { if (err instanceof Error && err.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "squadra-dcup.png";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showSuccess("Immagine scaricata! Aprila dalla galleria e condividila nelle Storie.");
    } catch (err) {
      dismissInfo();
      showError(`Impossibile generare l'immagine: ${err instanceof Error ? err.message : "Errore"}`);
    } finally {
      setLoading(false);
    }
  }

  const groups = groupMatchesByDate(matches.filter((m) => m.status === "CONCLUDED"));

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex items-center justify-center w-6 h-6"
        aria-label="Menu"
      >
        <i className="pi pi-ellipsis-v" style={{ fontSize: 12, color: "var(--text-primary)" }} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden"
            style={{
              background: "#fff",
              border: "1px solid rgba(9,20,76,0.08)",
              boxShadow: "0 8px 24px rgba(9,20,76,0.12)",
              minWidth: 164,
            }}
          >
            {editWindowOpen && (
              <>
                <button
                  onClick={() => { setMenuOpen(false); router.push("/squadra/modifica"); }}
                  className="w-full flex items-center gap-2 px-4 py-4 text-xs font-semibold active:bg-black/5"
                  style={{ color: "#1A7F37" }}
                >
                  <i className="pi pi-unlock text-xs" />
                  Modifica rosa
                </button>
                <div style={{ height: 1, background: "rgba(9,20,76,0.05)" }} />
              </>
            )}
            <button
              onClick={openSheet}
              className="w-full flex items-center px-4 py-4 text-xs text-black active:bg-black/5"
            >
              Partite
            </button>
            <div style={{ height: 1, background: "rgba(9,20,76,0.05)" }} />
            <a
              href="/regolamento"
              onClick={() => setMenuOpen(false)}
              className="flex items-center px-4 py-4 text-xs text-black active:bg-black/5"
            >
              Regolamento
            </a>
            {teamId !== undefined && (
              <>
                <div style={{ height: 1, background: "rgba(9,20,76,0.05)" }} />
                <button
                  onClick={handleShare}
                  disabled={loading}
                  className="w-full flex items-center px-4 py-4 text-xs text-black active:bg-black/5 disabled:opacity-50"
                >
                  {loading ? "Generando..." : "Condividi su Instagram"}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {sheetMounted && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(6,7,61,0.3)", opacity: sheetAnimIn ? 1 : 0, transition: "opacity 0.3s ease-out" }}
            onClick={closeSheet}
          />

          {/* Bottom sheet */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white flex flex-col mx-auto"
            style={{
              borderRadius: "24px 24px 0 0",
              height: "80svh",
              maxWidth: 512,
              transform: sheetAnimIn ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s ease-out",
            }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-2 pb-6 shrink-0">
              <span className="text-base text-black">Partite</span>
              <button
                type="button"
                onClick={closeSheet}
                aria-label="Chiudi"
                className="flex items-center justify-end w-6 h-6 rounded-full hover:bg-black/5 transition-colors"
              >
                <i className="pi pi-times text-sm" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-10">
              {groups.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "rgba(0,0,0,0.45)" }}>
                  Nessuna partita disponibile.
                </p>
              ) : groups.map((group) => (
                <div key={group.label} className="flex flex-col">
                  <p className="text-xs text-center mb-3 capitalize" style={{ color: "rgba(0,0,0,0.45)" }}>
                    {group.label}
                  </p>
                  <div className="flex flex-col">
                    {group.items.map((match, idx) => {
                      const homeName = match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD";
                      const awayName = match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD";
                      const scored = match.homeScore !== null && match.awayScore !== null;

                      return (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() => navigateTo(`/mvp/${match.id}`)}
                          className="relative flex items-center py-5 w-full"
                          style={idx < group.items.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : undefined}
                        >
                          <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                              {homeName}
                            </span>
                            <TeamFlag team={match.homeTeam} />
                          </div>
                          <span
                            className="shrink-0 text-sm font-semibold tabular-nums mx-5"
                            style={{ color: "var(--text-primary)", minWidth: 32, textAlign: "center" }}
                          >
                            {scored ? `${match.homeScore}-${match.awayScore}` : "vs"}
                          </span>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <TeamFlag team={match.awayTeam} />
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
    </div>
  );
}
