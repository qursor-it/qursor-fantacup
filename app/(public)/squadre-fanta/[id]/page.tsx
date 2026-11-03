import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicFantasyTeamDetail } from "@/lib/data/public/fantasy-rankings";
import { getPublicMatchesPageData } from "@/lib/data/public/matches";
import { db } from "@/lib/db";
import BackButton from "@/components/back-button";
import SquadraMenu from "@/components/squadra-menu";
import PlayerStatsTrigger from "@/components/player-stats-trigger";
import { resolveTeamFlag, resolveTeamKit } from "@/lib/flags";

export const revalidate = 60;

export default async function SquadraFantasyPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fase?: string }>;
}) {
  const [{ id }, { fase }] = await Promise.all([params, searchParams]);
  const teamId = Number(id);
  if (!Number.isInteger(teamId) || teamId <= 0) notFound();

  const detail = await getPublicFantasyTeamDetail(teamId);
  if (!detail) notFound();

  const { team, history, phaseBreakdown, lastClosedAt, totalPoints } = detail;

  const [dbPhases, { matches }] = await Promise.all([
    db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        startsAt: true,
        closedAt: true,
        scores: {
          where: { fantasyTeamId: teamId },
          select: { rosterPlayerIds: true, captainPlayerId: true },
        },
      },
    }),
    getPublicMatchesPageData(),
  ]);

  const selectedPhaseId: number | null =
    fase && fase !== "current" ? Number(fase) : null;

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

  let pitchPlayers: typeof team.players;
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
    pitchPlayers = team.players;
    pitchCaptainId = team.captainPlayerId;
  }

  const gk = pitchPlayers.find((p) => p.player.role === "P");
  const outfield = pitchPlayers.filter((p) => p.player.role === "A");
  const topRow = outfield.slice(0, 2);
  const bottomRow = outfield.slice(2);
  const showPoints = history.length > 0;

  return (
    <div className="flex flex-col flex-1">

      {/* Header */}
      <div className="flex items-center px-4">
        <div className="w-10 shrink-0 flex items-center">
          <BackButton />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 px-2 min-w-0">
          <span className="text-base font-semibold truncate w-full text-center" style={{ color: "var(--text-primary)" }}>
            {team.name}
          </span>
          <span className="text-xs truncate w-full text-center" style={{ color: "rgba(0,0,0,0.5)" }}>
            {team.ownerLabel}
          </span>
        </div>
        <div className="w-10 shrink-0 flex items-center justify-end">
          <SquadraMenu matches={matches} />
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
                href={`/squadre-fanta/${teamId}?fase=${phaseKey}`}
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

        {/* Top row — 2 players */}
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

        {/* Bottom row — 3+ players */}
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
