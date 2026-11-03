import "server-only";

import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { mvpPointsFromBonusType, resolveMvp } from "@/lib/domain/mvp";
import { resolveTeamFlag } from "@/lib/flags";

export type MvpPhase = {
  id: number | null; // null = fase in corso
  name: string;
};

export type MvpMatchRow = {
  matchId: number;
  label: string;
  concludedAt: Date;
  phaseId: number | null;
  homeShortName: string;
  awayShortName: string;
  homeScore: number | null;
  awayScore: number | null;
  mvpTeamSide: "home" | "away";
  mvpPlayer: {
    id: number;
    name: string;
    flagSrc: string | null;
    footballTeamName: string;
  };
};

export type MvpPlayerRow = {
  playerId: number;
  playerName: string;
  flagSrc: string | null;
  footballTeamName: string;
  count: number;
  matches: { matchId: number; label: string; concludedAt: Date }[];
};

export type PublicMvpData = {
  phases: MvpPhase[];
  byMatch: MvpMatchRow[];
  byPlayer: MvpPlayerRow[];
};

export async function getPublicMvpData(): Promise<PublicMvpData> {
  const [matches, closedPhases] = await Promise.all([
    db.match.findMany({
      where: { status: MatchStatus.CONCLUDED, concludedAt: { not: null } },
      orderBy: { concludedAt: "desc" },
      select: {
        id: true,
        concludedAt: true,
        homeSeed: true,
        awaySeed: true,
        homeScore: true,
        awayScore: true,
        mvpOverridePlayerId: true,
        homeTeamId: true,
        awayTeamId: true,
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
        votes: { select: { playerId: true } },
        players: {
          select: {
            playerId: true,
            player: {
              select: {
                id: true,
                name: true,
                footballTeam: {
                  select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true },
                },
              },
            },
          },
        },
      },
    }),
    db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, closedAt: true, startsAt: true },
    }),
  ]);

  // Build phases list (closed + "fase in corso")
  const phases: MvpPhase[] = [
    ...closedPhases.map((p) => ({ id: p.id, name: p.name })),
    { id: null, name: "Fase in corso" },
  ];

  function resolvePhaseId(concludedAt: Date): number | null {
    for (const p of closedPhases) {
      if (p.startsAt && concludedAt < p.startsAt) continue;
      if (concludedAt < p.closedAt) return p.id;
    }
    return null;
  }

  const byMatch: MvpMatchRow[] = [];
  const byPlayerMap = new Map<number, MvpPlayerRow>();

  for (const match of matches) {
    const resolution = resolveMvp({
      concludedAt: match.concludedAt,
      votes: match.votes,
      mvpOverridePlayerId: match.mvpOverridePlayerId,
      eligiblePlayerIds: match.players.map((p) => p.playerId),
    });

    if (resolution.status !== "resolved") continue;

    const mp = match.players.find((p) => p.playerId === resolution.playerId);
    if (!mp) continue;

    const homeShortName = match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD";
    const awayShortName = match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD";
    const label = `${homeShortName} vs ${awayShortName}`;
    const flagSrc = resolveTeamFlag(mp.player.footballTeam);
    const phaseId = resolvePhaseId(match.concludedAt!);

    const mvpTeamSide: "home" | "away" =
      mp.player.footballTeam.id === match.homeTeamId ? "home" : "away";

    const matchRow: MvpMatchRow = {
      matchId: match.id,
      label,
      concludedAt: match.concludedAt!,
      phaseId,
      homeShortName,
      awayShortName,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      mvpTeamSide,
      mvpPlayer: {
        id: mp.player.id,
        name: mp.player.name,
        flagSrc,
        footballTeamName: mp.player.footballTeam.name,
      },
    };

    byMatch.push(matchRow);

    const existing = byPlayerMap.get(mp.player.id);
    if (existing) {
      existing.count += 1;
      existing.matches.push({ matchId: match.id, label, concludedAt: match.concludedAt! });
    } else {
      byPlayerMap.set(mp.player.id, {
        playerId: mp.player.id,
        playerName: mp.player.name,
        flagSrc,
        footballTeamName: mp.player.footballTeam.name,
        count: 1,
        matches: [{ matchId: match.id, label, concludedAt: match.concludedAt! }],
      });
    }
  }

  const byPlayer = [...byPlayerMap.values()].sort(
    (a, b) => b.count - a.count || a.playerName.localeCompare(b.playerName, "it")
  );

  return { phases, byMatch, byPlayer };
}

export type MvpPlayerVote = {
  playerId: number;
  playerName: string;
  footballTeamName: string;
  flagSrc: string | null;
  teamSide: "home" | "away";
  isMvp: boolean;
  voteCount: number;
  goals: number;
  ownGoals: number;
  totalPoints: number;
  bonuses: Array<{ name: string; points: number; quantity: number }>;
};

export type MvpMatchDetail = {
  match: {
    homeTeamName: string;
    awayTeamName: string;
    homeTeamFlagSrc: string | null;
    awayTeamFlagSrc: string | null;
    homeScore: number | null;
    awayScore: number | null;
  };
  mvpPlayer: {
    name: string;
    flagSrc: string | null;
  };
  mvpBonusPoints: number;
  homeGoals: string[];
  awayGoals: string[];
  playerVotes: MvpPlayerVote[];
};

export async function getMvpMatchDetail(matchId: number): Promise<MvpMatchDetail | null> {
  const [match, mvpBonusType] = await Promise.all([
    db.match.findUnique({
      where: { id: matchId, status: MatchStatus.CONCLUDED },
      select: {
        concludedAt: true,
        homeScore: true,
        awayScore: true,
        homeSeed: true,
        awaySeed: true,
        homeTeamId: true,
        awayTeamId: true,
        mvpOverridePlayerId: true,
        homeTeam: { select: { name: true, shortName: true, countryCode: true, logoUrl: true } },
        awayTeam: { select: { name: true, shortName: true, countryCode: true, logoUrl: true } },
        votes: { select: { playerId: true } },
        players: {
          select: {
            playerId: true,
            player: {
              select: {
                id: true,
                name: true,
                footballTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
              },
            },
          },
        },
        goals: {
          orderBy: { minute: "asc" },
          select: {
            scorerId: true,
            isOwnGoal: true,
            scorer: { select: { name: true, footballTeamId: true } },
          },
        },
        bonuses: {
          where: { bonusType: { code: { not: "MVP" } } },
          select: {
            playerId: true,
            quantity: true,
            points: true,
            bonusType: { select: { name: true } },
          },
        },
      },
    }),
    db.bonusType.findFirst({ where: { code: "MVP" }, select: { points: true } }),
  ]);

  if (!match) return null;

  const resolution = resolveMvp({
    concludedAt: match.concludedAt,
    votes: match.votes,
    mvpOverridePlayerId: match.mvpOverridePlayerId,
    eligiblePlayerIds: match.players.map((p) => p.playerId),
  });

  if (resolution.status !== "resolved") return null;

  const mp = match.players.find((p) => p.playerId === resolution.playerId);
  if (!mp) return null;

  const homeGoals: string[] = [];
  const awayGoals: string[] = [];

  for (const g of match.goals) {
    const scorerIsHome = g.scorer.footballTeamId === match.homeTeamId;
    const countsForHome = g.isOwnGoal ? !scorerIsHome : scorerIsHome;
    if (countsForHome) {
      homeGoals.push(g.scorer.name);
    } else {
      awayGoals.push(g.scorer.name);
    }
  }

  // Vote counts per player
  // Solo voti per giocatori presenti in partita (coerente con resolveMvp)
  const voteCounts = new Map<number, number>();
  for (const v of resolution.voteCounts) voteCounts.set(v.playerId, v.votes);

  // Goals per player
  const goalsByPlayer = new Map<number, { goals: number; ownGoals: number }>();
  for (const g of match.goals) {
    if (!g.scorerId) continue;
    const cur = goalsByPlayer.get(g.scorerId) ?? { goals: 0, ownGoals: 0 };
    if (g.isOwnGoal) cur.ownGoals += 1;
    else cur.goals += 1;
    goalsByPlayer.set(g.scorerId, cur);
  }

  // Bonuses per player, aggregated by bonus type name
  const bonusByPlayer = new Map<number, Map<string, { name: string; points: number; quantity: number }>>();
  for (const b of match.bonuses) {
    if (!bonusByPlayer.has(b.playerId)) bonusByPlayer.set(b.playerId, new Map());
    const byName = bonusByPlayer.get(b.playerId)!;
    const existing = byName.get(b.bonusType.name);
    if (existing) {
      existing.quantity += b.quantity;
      existing.points += Number(b.points);
    } else {
      byName.set(b.bonusType.name, { name: b.bonusType.name, points: Number(b.points), quantity: b.quantity });
    }
  }

  const mvpBonusValue = mvpPointsFromBonusType(mvpBonusType);

  const playerVotes: MvpPlayerVote[] = match.players
    .map(({ playerId, player }) => {
      const gs = goalsByPlayer.get(playerId) ?? { goals: 0, ownGoals: 0 };
      const bonusMap = bonusByPlayer.get(playerId) ?? new Map();
      const teamSide: "home" | "away" =
        player.footballTeam.id === match.homeTeamId ? "home" : "away";
      const nonMvpPoints = [...bonusMap.values()].reduce((s, b) => s + b.points, 0);
      const isMvp = playerId === resolution.playerId;
      return {
        playerId,
        playerName: player.name,
        footballTeamName: player.footballTeam.name,
        flagSrc: resolveTeamFlag(player.footballTeam),
        teamSide,
        isMvp,
        voteCount: voteCounts.get(playerId) ?? 0,
        goals: gs.goals,
        ownGoals: gs.ownGoals,
        totalPoints: nonMvpPoints + (isMvp ? mvpBonusValue : 0),
        bonuses: [...bonusMap.values()],
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount || a.playerName.localeCompare(b.playerName, "it"));

  return {
    match: {
      homeTeamName: match.homeTeam?.name ?? match.homeSeed ?? "TBD",
      awayTeamName: match.awayTeam?.name ?? match.awaySeed ?? "TBD",
      homeTeamFlagSrc: match.homeTeam ? resolveTeamFlag(match.homeTeam) : null,
      awayTeamFlagSrc: match.awayTeam ? resolveTeamFlag(match.awayTeam) : null,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    },
    mvpPlayer: {
      name: mp.player.name,
      flagSrc: resolveTeamFlag(mp.player.footballTeam),
    },
    mvpBonusPoints: mvpBonusValue,
    homeGoals,
    awayGoals,
    playerVotes,
  };
}
