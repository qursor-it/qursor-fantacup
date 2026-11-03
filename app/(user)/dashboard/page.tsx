import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AUTH_ONBOARDING_PATH } from "@/lib/post-auth";
import { getTeamPhaseBreakdown } from "@/lib/scoring";
import { getFantasyRankingSnapshotOrCompute } from "@/lib/fantasy-ranking-snapshot";
import { getActiveEditWindow } from "@/lib/roster-edit-window";
import { getPublicMvpData } from "@/lib/data/public/mvp";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(9,20,76,0.05)",
  boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)",
};

const DARK_CARD: React.CSSProperties = {
  background: "#0F195A",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow: "0 4px 10px 0 rgba(0,0,0,0.4)",
};

export default async function DashboardPage() {
  const user = await requireAuth();
  const userId = Number(user.id);

  const fantasyTeam = await db.fantasyTeam.findUnique({
    where: { userId },
    select: { id: true, name: true },
  });

  if (!fantasyTeam) redirect(AUTH_ONBOARDING_PATH);

  const editWindow = await getActiveEditWindow();
  let changesLeft = 0;
  if (editWindow) {
    const usage = await db.rosterEditUsage.findUnique({
      where: { windowId_fantasyTeamId: { windowId: editWindow.id, fantasyTeamId: fantasyTeam.id } },
      select: { changesUsed: true },
    });
    changesLeft = Math.max(0, editWindow.maxChanges - (usage?.changesUsed ?? 0));
  }
  const editWindowClosesAt = editWindow
    ? editWindow.closesAt.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome",
      })
    : null;

  const [phaseBreakdown, rankings, mvpData] = await Promise.all([
    getTeamPhaseBreakdown(fantasyTeam.id),
    getFantasyRankingSnapshotOrCompute(),
    getPublicMvpData(),
  ]);

  const totalPoints = phaseBreakdown.reduce((s, p) => s + p.points, 0);
  const userRank = rankings.find((r) => r.fantasyTeamId === fantasyTeam.id)?.rank ?? null;
  const currentPhase = phaseBreakdown.find((p) => p.current);
  const mvpMatches = mvpData.byMatch;

  return (
    <div className="flex flex-col gap-10">

      {/* Banner mercato aperto */}
      {editWindow && (
        <div className="rounded-3xl p-6 flex flex-col gap-4" style={CARD}>
          <h2
            className="text-base font-medium uppercase"
            style={{ fontFamily: "var(--font-tallica)", color: "var(--text-primary)", lineHeight: "34px" }}
          >
            Mercato aperto
          </h2>
          <p className="text-sm text-black">
            Hai <strong>{changesLeft}/{editWindow.maxChanges} cambi</strong> disponibili.
            La finestra chiude il <strong>{editWindowClosesAt}</strong>.
          </p>
          <div className="flex gap-3">
            <Link
              href="/squadra/modifica"
              className="flex flex-1 items-center justify-center rounded-lg py-2"
              style={{ background: "var(--text-primary)" }}
            >
              <span className="text-sm font-semibold text-white">Modifica rosa</span>
            </Link>
            <Link
              href="/squadra"
              className="flex flex-1 items-center justify-center rounded-lg py-2"
              style={{ border: "1px solid rgba(9,20,76,0.15)", color: "var(--text-primary)" }}
            >
              <span className="text-sm font-semibold">Vedi squadra</span>
            </Link>
          </div>
        </div>
      )}

      {/* Promo card (solo se mercato chiuso) */}
      {!editWindow && (
        <div className="rounded-3xl p-6 flex flex-col gap-4" style={CARD}>
          <h2
            className="text-base font-medium uppercase"
            style={{ fontFamily: "var(--font-tallica)", color: "var(--text-primary)", lineHeight: "34px" }}
          >
            Scopri l&apos;andamento della tua squadra
          </h2>
          <p className="text-sm text-black">
            La competizione è entrata nel vivo. Come sta andando la tua squadra?
          </p>
          <Link
            href="/squadra"
            className="flex items-center justify-center rounded-lg py-2 w-full"
            style={{ background: "var(--text-primary)" }}
          >
            <span className="text-sm text-white font-semibold">Vedi squadra</span>
          </Link>
        </div>
      )}

      {/* Stats card */}
      <div className="rounded-3xl p-6 flex flex-col gap-4" style={CARD}>
        <div
          className="pb-4"
          style={{ borderBottom: "1px solid rgba(9,20,76,0.05)" }}
        >
          <p className="text-base font-medium text-black">{fantasyTeam.name}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-2 flex-1 items-start">
            <p className="text-[10px] text-black">Pti totali</p>
            <p className="text-base font-semibold text-black leading-6 tabular-nums">
              {totalPoints.toFixed(1)}
            </p>
          </div>
          <div className="w-px self-stretch" style={{ background: "rgba(9,20,76,0.05)" }} />
          <div className="flex flex-col gap-2 flex-1 items-start">
            <p className="text-[10px] text-black">Classifica globale</p>
            <p className="text-base font-semibold text-black leading-6 tabular-nums">
              {userRank ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Player of the Match */}
      {mvpMatches.length > 0 && (
        <div className="rounded-3xl p-6 flex flex-col" style={CARD}>
          <div className="flex flex-col gap-0.5">
            <p className="text-base font-medium text-black">Player of the Match</p>
            {currentPhase && (
              <p className="text-xs" style={{ color: "rgba(0,0,0,0.45)" }}>{currentPhase.name}</p>
            )}
          </div>

          <div
            className="flex gap-3 overflow-x-auto -mx-6 px-6 py-5"
            style={{ scrollbarWidth: "none" } as React.CSSProperties}
          >
            {mvpMatches.slice(0, 2).map((m) => {
              const parts = m.label.split(" vs ");
              return (
                <Link
                  key={m.matchId}
                  href={`/mvp/${m.matchId}`}
                  className="flex flex-col items-center justify-center gap-4 p-6 rounded-2xl shrink-0 w-32"
                  style={DARK_CARD}
                >
                  <div className="relative">
                    <img src="/icons/star.svg" alt="MVP" width={12} height={12} className="absolute z-10" style={{ top: -6, right: -6 }} />
                    {m.mvpPlayer.flagSrc ? (
                      <img src={m.mvpPlayer.flagSrc} alt={m.mvpPlayer.footballTeamName} width={40} height={27} />
                    ) : (
                      <div
                        className="w-10 h-[27px] rounded flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.10)" }}
                      >
                        <span className="text-[9px] font-bold text-white">
                          {m.mvpPlayer.footballTeamName.slice(0, 3).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 text-center w-full">
                    <p className="text-xs text-white font-semibold truncate max-w-full">{m.mvpPlayer.name.split(" ").at(-1)}</p>
                    <p className="text-[10px] whitespace-nowrap" style={{ color: "rgba(255,255,255,0.75)" }}>
                      <span className={m.mvpTeamSide === "home" ? "font-semibold text-white" : ""}>{parts[0]}</span>
                      {parts[1] ? <> - <span className={m.mvpTeamSide === "away" ? "font-semibold text-white" : ""}>{parts[1]}</span></> : null}
                    </p>
                  </div>
                </Link>
              );
            })}

            <Link
              href="/mvp"
              className="flex items-center justify-center p-4 rounded-2xl shrink-0 w-32 self-stretch text-center"
              style={DARK_CARD}
            >
              <p className="text-xs text-white font-semibold leading-normal">
                Vedi giornata precedente
              </p>
            </Link>
          </div>

          <Link
            href="/mvp"
            className="text-xs font-semibold whitespace-nowrap"
            style={{ color: "var(--text-primary)" }}
          >
            Scopri i precedenti vincitori
          </Link>
        </div>
      )}

    </div>
  );
}
