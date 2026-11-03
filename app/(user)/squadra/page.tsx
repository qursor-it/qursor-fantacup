import Link from "next/link";
import { redirect } from "next/navigation";
import BackButton from "@/components/back-button";
import SquadraMenu from "@/components/squadra-menu";
import PlayerStatsTrigger from "@/components/player-stats-trigger";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { computeFrozenPhaseAdjustment, computeTeamHistory, getLastClosedAt, getTeamPhaseBreakdown } from "@/lib/scoring";
import { getPublicMatchesPageData } from "@/lib/data/public/matches";
import { AUTH_ONBOARDING_PATH } from "@/lib/post-auth";
import { resolveTeamFlag, resolveTeamKit } from "@/lib/flags";
import { getActiveEditWindow } from "@/lib/roster-edit-window";

export const dynamic = "force-dynamic";

export default async function SquadraPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string }>;
}) {
  const { fase } = await searchParams;
  const user = await requireAuth();
  const userId = Number(user.id);

  const fantasyTeam = await db.fantasyTeam.findUnique({
    where: { userId },
    include: {
      players: {
        include: {
          player: {
            include: {
              footballTeam: {
                select: { name: true, shortName: true, countryCode: true, logoUrl: true },
              },
            },
          },
        },
      },
    },
  });

  if (!fantasyTeam) redirect(AUTH_ONBOARDING_PATH);

  // Determine selected phase: null = fase in corso
  const selectedPhaseId: number | null =
    fase && fase !== "current" ? Number(fase) : null;

  const [history, lastClosedAt, phaseBreakdown, dbPhases, { matches }, editWindow] = await Promise.all([
    computeTeamHistory(fantasyTeam.id),
    getLastClosedAt(),
    getTeamPhaseBreakdown(fantasyTeam.id),
    db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        startsAt: true,
        closedAt: true,
        scores: {
          where: { fantasyTeamId: fantasyTeam.id },
          select: { rosterPlayerIds: true, captainPlayerId: true },
        },
      },
    }),
    getPublicMatchesPageData(),
    getActiveEditWindow(),
  ]);

  const phasePlayerTotals = new Map<number, number>();
  for (const ms of history) {
    const at = ms.concludedAt;
    if (!at) continue;
    if (selectedPhaseId === null) {
      if (lastClosedAt && at < lastClosedAt) continue;
    } else {
      const p = dbPhases.find((ph) => ph.id === selectedPhaseId);
      if (!p) continue;
      if (p.startsAt && at < p.startsAt) continue;
      if (at >= p.closedAt) continue;
    }
    for (const ps of ms.playerScores) {
      phasePlayerTotals.set(ps.playerId, (phasePlayerTotals.get(ps.playerId) ?? 0) + ps.finalPoints);
    }
  }

  // Per le fasi congelate usa la rosa storica dello snapshot
  const frozenScore = selectedPhaseId !== null
    ? (dbPhases.find((p) => p.id === selectedPhaseId)?.scores[0] ?? null)
    : null;

  let pitchPlayers: { player: { id: number; name: string; role: string; footballTeam: { name: string; shortName: string | null; countryCode: string | null; logoUrl: string | null } } }[];
  let pitchCaptainId: number;

  if (frozenScore) {
    const frozenIds = frozenScore.rosterPlayerIds as number[];
    const frozenRecords = await db.player.findMany({
      where: { id: { in: frozenIds } },
      select: { id: true, name: true, role: true, footballTeam: { select: { name: true, shortName: true, countryCode: true, logoUrl: true } } },
    });
    const byId = new Map(frozenRecords.map((p) => [p.id, p]));
    pitchPlayers = frozenIds.flatMap((id) => { const p = byId.get(id); return p ? [{ player: p }] : []; });
    pitchCaptainId = frozenScore.captainPlayerId;
  } else {
    pitchPlayers = fantasyTeam.players;
    pitchCaptainId = fantasyTeam.captainPlayerId;
  }

  const gk = pitchPlayers.find((p) => p.player.role === "P");
  const outfield = pitchPlayers.filter((p) => p.player.role === "A");
  const topRow = outfield.slice(0, 2);
  const bottomRow = outfield.slice(2);
  const showPoints = history.length > 0;
  const totalPoints = phaseBreakdown.reduce((s, p) => s + p.points, 0);
  const phaseAdjustment =
    selectedPhaseId !== null
      ? computeFrozenPhaseAdjustment(
          phaseBreakdown.find((p) => p.phaseId === selectedPhaseId)?.points ?? 0,
          [...phasePlayerTotals.values()].reduce((sum, pts) => sum + pts, 0)
        )
      : 0;

  return (
    <div className="flex flex-col flex-1">

      {/* Header */}
      <div className="flex items-center px-4">
        <div className="w-16 shrink-0 flex items-center">
          <BackButton />
        </div>
        <div className="flex-1 flex items-center justify-center min-w-0 px-2">
          <span className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {fantasyTeam.name}
          </span>
        </div>
        <div className="w-16 shrink-0 flex items-center justify-end gap-2">
          {showPoints && (
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs text-black font-semibold tabular-nums">
                {totalPoints.toFixed(0)}
              </span>
              <span className="text-[10px] font-normal text-black/75">
                pti
              </span>
            </div>
          )}
          <SquadraMenu teamId={fantasyTeam.id} matches={matches} editWindowOpen={!!editWindow} />
        </div>
      </div>

      {/* Phase score scroll */}
      {phaseBreakdown.length > 0 && (
        <div
          className="flex gap-10 overflow-x-auto px-4 mt-10"
          style={{ scrollbarWidth: "none", borderBottom: "1px solid rgba(9,20,76,0.08)" } as React.CSSProperties}
        >
          {phaseBreakdown.map((p) => {
            const phaseKey = p.phaseId === null ? "current" : String(p.phaseId);
            const isActive = p.phaseId === selectedPhaseId;
            return (
              <Link
                key={phaseKey}
                href={`/squadra?fase=${phaseKey}`}
                replace
                className="flex flex-col gap-2 items-center shrink-0"
              >
                <span className="text-xs" style={{ color: "rgba(0,0,0,0.65)" }}>{p.name}</span>
                <span
                  className="text-sm font-semibold tabular-nums pb-0.5"
                  style={{
                    color: "#09144C",
                    borderBottom: isActive ? "1.5px solid #09144C" : undefined,
                  }}
                >
                  {p.points.toFixed(0)} pti
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Football pitch */}
      <div className="relative flex flex-col items-center justify-around py-12 mt-6 flex-1">
        <img
          src="/images/football-field.webp"
          alt=""
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover"
        />

        {/* Top row — 2 forwards */}
        {topRow.length > 0 && (
          <div className="flex gap-8 items-end justify-center relative z-10">
            {topRow.map(({ player }) => (
              <PlayerStatsTrigger key={player.id} playerId={player.id}>
                <PlayerCard
                  player={player}
                  isCaptain={player.id === pitchCaptainId}
                  points={showPoints ? (phasePlayerTotals.get(player.id) ?? 0) : null}
                />
              </PlayerStatsTrigger>
            ))}
          </div>
        )}

        {/* Bottom row — midfielders / defenders */}
        {bottomRow.length > 0 && (
          <div className="flex gap-16 items-end justify-center relative z-10">
            {bottomRow.map(({ player }) => (
              <PlayerStatsTrigger key={player.id} playerId={player.id}>
                <PlayerCard
                  player={player}
                  isCaptain={player.id === pitchCaptainId}
                  points={showPoints ? (phasePlayerTotals.get(player.id) ?? 0) : null}
                />
              </PlayerStatsTrigger>
            ))}
          </div>
        )}

        {/* Goalkeeper */}
        {gk && (
          <div className="relative z-10">
            <PlayerStatsTrigger playerId={gk.player.id}>
              <PlayerCard
                player={gk.player}
                isCaptain={gk.player.id === pitchCaptainId}
                points={showPoints ? (phasePlayerTotals.get(gk.player.id) ?? 0) : null}
              />
            </PlayerStatsTrigger>
          </div>
        )}

        {/* Rettifica fase congelata: allinea le righe al totale dello snapshot */}
        {phaseAdjustment !== 0 && (
          <div
            className="relative z-10 flex items-center justify-center gap-2 px-3 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.92)", color: "#09144C" }}
          >
            <span className="text-[11px] font-medium">Rettifica storico congelato</span>
            <span className="text-[11px] font-semibold tabular-nums">
              {phaseAdjustment.toFixed(1)} pti
            </span>
          </div>
        )}

        {/* Mercato aperto overlay */}
        {editWindow && (
          <Link
            href="/squadra/modifica"
            className="absolute bottom-8 inset-x-4 z-20 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: "var(--text-primary)" }}
          >
            <i className="pi pi-unlock text-xs" />
            Modifica rosa
          </Link>
        )}
      </div>

    </div>
  );
}

function PlayerCard({
  player,
  isCaptain,
  points,
}: {
  player: {
    id: number;
    name: string;
    footballTeam: { name: string; shortName: string | null; countryCode: string | null; logoUrl: string | null };
  };
  isCaptain: boolean;
  points: number | null;
}) {
  const flagSrc = resolveTeamFlag(player.footballTeam);
  const kitSrc = resolveTeamKit(player.footballTeam);
  const parts = player.name.trim().split(/\s+/);
  const shortName = parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : player.name;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {isCaptain && (
          <img
            src="/icons/star.svg"
            alt="Capitano"
            width={12}
            height={12}
            className="absolute -top-1 -right-1 z-10"
          />
        )}
        {kitSrc ? (
          <img src={kitSrc} alt={player.footballTeam.name} width={56} height={56} className="object-contain" />
        ) : (
          <div
            className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.35)" }}
          >
            {flagSrc ? (
              <img src={flagSrc} alt={player.footballTeam.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-bold text-sm">
                {(player.footballTeam.shortName ?? player.footballTeam.name).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-center px-2"
        style={{ background: "#09144C", width: 90, minHeight: 22 }}
      >
        <span className="text-white text-[11px] font-medium truncate">{shortName}</span>
      </div>

      {points !== null && (
        <div
          className="flex items-center justify-center gap-1.5 px-2"
          style={{ background: "white", width: 90, minHeight: 22 }}
        >
          {flagSrc && (
            <img src={flagSrc} alt="" width={14} height={9} className="shrink-0 object-contain" />
          )}
          <span className="text-[11px] font-medium tabular-nums" style={{ color: "#09144C" }}>
            {points.toFixed(1)} pti
          </span>
        </div>
      )}
    </div>
  );
}
