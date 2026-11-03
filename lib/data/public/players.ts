import "server-only";

import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { resolveTeamFlag } from "@/lib/flags";
import { getOfficialMvpPlayerId, mvpPointsFromBonusType } from "@/lib/domain/mvp";
import { roundPoints } from "@/lib/scoring";
import { cachePublicData, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS } from "./cache";

export type PublicScorerRankingRow = {
  id: number;
  name: string;
  goals: number;
  footballTeam: {
    name: string;
    shortName: string | null;
    countryCode: string | null;
    logoUrl: string | null;
  };
  flagSrc: string | null;
};

export type PublicPlayerGridRow = {
  id: number;
  name: string;
  role: string;
  footballTeam: {
    name: string;
    shortName: string | null;
    countryCode: string | null;
    logoUrl: string | null;
  };
  totalGoals: number;
  totalOwnGoals: number;
  totalBonusPoints: number;
  presenze: number;
  pickRate: number;
  matchStats: Array<{
    matchId: number;
    startsAt: string;
    isHome: boolean;
    opponent: string;
    opponentCountryCode: string | null;
    phase: string | null;
    hs: number | null;
    as_: number | null;
    won: boolean;
    lost: boolean;
    matchGoals: number;
    matchBonusPoints: number;
    bonuses: Array<{ name: string; points: number; quantity: number }>;
  }>;
};

export type PublicPlayersGroup = {
  teamName: string;
  players: PublicPlayerGridRow[];
};

export type PublicFantasyPlayerPickRow = {
  rank: number;
  playerId: number;
  playerName: string;
  role: string;
  footballTeamName: string;
  footballTeamShortName: string | null;
  flagSrc: string | null;
  pickCount: number;
  pickRate: number;
  fantasyTeams: Array<{
    id: number;
    name: string;
    ownerLabel: string;
  }>;
};

export const getPublicScorerRanking = cachePublicData(
  "data.public.players.scorers.fetch",
  async (): Promise<PublicScorerRankingRow[]> => {
    const [players, goals] = await Promise.all([
      db.player.findMany({
        select: {
          id: true,
          name: true,
          footballTeam: {
            select: {
              name: true,
              shortName: true,
              countryCode: true,
              logoUrl: true,
            },
          },
        },
      }),
      db.matchGoal.findMany({
        where: { isOwnGoal: false },
        select: { scorerId: true },
      }),
    ]);

    const goalMap = new Map<number, number>();
    for (const goal of goals) {
      goalMap.set(goal.scorerId, (goalMap.get(goal.scorerId) ?? 0) + 1);
    }

    return players
      .map((player) => ({
        ...player,
        goals: goalMap.get(player.id) ?? 0,
        flagSrc: resolveTeamFlag(player.footballTeam),
      }))
      .filter((player) => player.goals > 0)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "it"));
  },
  ["data.public.players.scorers"],
  {
    tags: [PUBLIC_CACHE_TAGS.dcup, PUBLIC_CACHE_TAGS.dcupScorers],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
  }
);

export const getPublicPlayersGroups = cachePublicData(
  "data.public.players.index.fetch",
  async (): Promise<PublicPlayersGroup[]> => {
    // I punti seguono esattamente lib/scoring.ts: solo partite CONCLUDED, bonus
    // con codice MVP esclusi (l'MVP deriva dai voti/override) + bonus MVP ufficiale.
    const [players, appearances, goals, bonuses, totalFantasyTeams, mvpMatches, mvpBonusType] = await Promise.all([
      db.player.findMany({
        orderBy: [{ footballTeam: { name: "asc" } }, { role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          role: true,
          footballTeamId: true,
          footballTeam: {
            select: { name: true, shortName: true, countryCode: true, logoUrl: true },
          },
          _count: { select: { fantasyTeams: true } },
        },
      }),
      db.matchPlayer.findMany({
        where: { match: { status: MatchStatus.CONCLUDED } },
        select: {
          playerId: true,
          match: {
            select: {
              id: true,
              startsAt: true,
              homeScore: true,
              awayScore: true,
              homeTeamId: true,
              awayTeamId: true,
              homeSeed: true,
              awaySeed: true,
              homeTeam: { select: { shortName: true, name: true, countryCode: true } },
              awayTeam: { select: { shortName: true, name: true, countryCode: true } },
              group: { select: { name: true } },
              knockoutRound: { select: { name: true } },
            },
          },
        },
        orderBy: { match: { startsAt: "asc" } },
      }),
      db.matchGoal.findMany({
        select: { matchId: true, scorerId: true, isOwnGoal: true },
      }),
      db.playerMatchBonus.findMany({
        where: { match: { status: MatchStatus.CONCLUDED }, bonusType: { code: { not: "MVP" } } },
        select: {
          playerId: true,
          matchId: true,
          points: true,
          quantity: true,
          bonusType: { select: { name: true } },
        },
      }),
      db.fantasyTeam.count(),
      db.match.findMany({
        where: { status: MatchStatus.CONCLUDED },
        select: {
          id: true,
          concludedAt: true,
          mvpOverridePlayerId: true,
          votes: { select: { playerId: true } },
          players: { select: { playerId: true } },
        },
      }),
      db.bonusType.findFirst({ where: { code: "MVP" }, select: { points: true } }),
    ]);

    const mvpBonus = mvpPointsFromBonusType(mvpBonusType);
    const mvpByMatch = new Map<number, number>();
    for (const match of mvpMatches) {
      const mvpId = getOfficialMvpPlayerId({
        concludedAt: match.concludedAt,
        votes: match.votes,
        mvpOverridePlayerId: match.mvpOverridePlayerId,
        eligiblePlayerIds: match.players.map((p) => p.playerId),
      });
      if (mvpId !== null) mvpByMatch.set(match.id, mvpId);
    }

    const appearancesByPlayer = new Map<number, typeof appearances>();
    for (const appearance of appearances) {
      const rows = appearancesByPlayer.get(appearance.playerId) ?? [];
      rows.push(appearance);
      appearancesByPlayer.set(appearance.playerId, rows);
    }

    const goalsByPlayer = new Map<number, typeof goals>();
    for (const goal of goals) {
      const rows = goalsByPlayer.get(goal.scorerId) ?? [];
      rows.push(goal);
      goalsByPlayer.set(goal.scorerId, rows);
    }

    const bonusesByPlayer = new Map<number, typeof bonuses>();
    for (const bonus of bonuses) {
      const rows = bonusesByPlayer.get(bonus.playerId) ?? [];
      rows.push(bonus);
      bonusesByPlayer.set(bonus.playerId, rows);
    }

    const enriched: PublicPlayerGridRow[] = players.map((player) => {
      const playerAppearances = appearancesByPlayer.get(player.id) ?? [];
      const playerGoals = goalsByPlayer.get(player.id) ?? [];
      const playerBonuses = bonusesByPlayer.get(player.id) ?? [];

      const totalGoals = playerGoals.filter((goal) => !goal.isOwnGoal).length;
      const totalOwnGoals = playerGoals.filter((goal) => goal.isOwnGoal).length;
      let mvpCount = 0;
      for (const mvpId of mvpByMatch.values()) if (mvpId === player.id) mvpCount += 1;
      const totalBonusPoints = roundPoints(
        playerBonuses.reduce((sum, bonus) => sum + Number(bonus.points), 0) + mvpCount * mvpBonus
      );

      const pickRate = totalFantasyTeams > 0
        ? (player._count.fantasyTeams / totalFantasyTeams) * 100
        : 0;

      const matchStats = playerAppearances.map((appearance) => {
        const match = appearance.match;
        const isHome = match.homeTeamId === player.footballTeamId;
        const hs = isHome ? match.homeScore : match.awayScore;
        const as_ = isHome ? match.awayScore : match.homeScore;
        const opponent = isHome
          ? (match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD")
          : (match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD");
        const opponentCountryCode = isHome
          ? (match.awayTeam?.countryCode ?? null)
          : (match.homeTeam?.countryCode ?? null);
        const phase = match.group?.name ?? match.knockoutRound?.name ?? null;
        const matchGoals = playerGoals.filter(
          (goal) => goal.matchId === match.id && !goal.isOwnGoal
        ).length;
        const matchBonusEntries = playerBonuses.filter((b) => b.matchId === match.id);
        const isMvp = mvpByMatch.get(match.id) === player.id;
        const matchBonusPoints = roundPoints(
          matchBonusEntries.reduce((sum, bonus) => sum + Number(bonus.points), 0) +
            (isMvp ? mvpBonus : 0)
        );
        const won = hs !== null && as_ !== null && hs > as_;
        const lost = hs !== null && as_ !== null && hs < as_;

        return {
          matchId: match.id,
          startsAt: match.startsAt.toISOString(),
          isHome,
          opponent,
          opponentCountryCode,
          phase,
          hs,
          as_,
          won,
          lost,
          matchGoals,
          matchBonusPoints,
          bonuses: [
            ...matchBonusEntries.map((b) => ({
              name: b.bonusType.name,
              points: Number(b.points),
              quantity: b.quantity,
            })),
            ...(isMvp ? [{ name: "MVP", points: mvpBonus, quantity: 1 }] : []),
          ],
        };
      });

      return {
        id: player.id,
        name: player.name,
        role: player.role,
        footballTeam: player.footballTeam,
        totalGoals,
        totalOwnGoals,
        totalBonusPoints,
        presenze: playerAppearances.length,
        pickRate,
        matchStats,
      };
    });

    const byTeam = new Map<string, PublicPlayerGridRow[]>();
    for (const player of enriched) {
      const rows = byTeam.get(player.footballTeam.name) ?? [];
      rows.push(player);
      byTeam.set(player.footballTeam.name, rows);
    }

    return [...byTeam.entries()].map(([teamName, teamPlayers]) => ({
      teamName,
      players: teamPlayers,
    }));
  },
  ["data.public.players.index"],
  {
    tags: [
      PUBLIC_CACHE_TAGS.bonuses,
      PUBLIC_CACHE_TAGS.dcup,
      PUBLIC_CACHE_TAGS.dcupMatches,
      PUBLIC_CACHE_TAGS.dcupPlayers,
      PUBLIC_CACHE_TAGS.dcupScorers,
    ],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
  }
);

export async function getPublicPlayerById(id: number): Promise<PublicPlayerGridRow | null> {
  const [player, totalFantasyTeams] = await Promise.all([
    db.player.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        footballTeamId: true,
        footballTeam: {
          select: { name: true, shortName: true, countryCode: true, logoUrl: true },
        },
        _count: { select: { fantasyTeams: true } },
      },
    }),
    db.fantasyTeam.count(),
  ]);

  if (!player) return null;

  const [appearances, goals, bonuses, mvpBonusType] = await Promise.all([
    db.matchPlayer.findMany({
      where: { playerId: id, match: { status: MatchStatus.CONCLUDED } },
      select: {
        match: {
          select: {
            id: true,
            startsAt: true,
            homeScore: true,
            awayScore: true,
            homeTeamId: true,
            awayTeamId: true,
            homeSeed: true,
            awaySeed: true,
            concludedAt: true,
            mvpOverridePlayerId: true,
            homeTeam: { select: { shortName: true, name: true, countryCode: true } },
            awayTeam: { select: { shortName: true, name: true, countryCode: true } },
            group: { select: { name: true } },
            knockoutRound: { select: { name: true } },
            votes: { select: { playerId: true } },
            players: { select: { playerId: true } },
          },
        },
      },
      orderBy: { match: { startsAt: "asc" } },
    }),
    db.matchGoal.findMany({
      where: { scorerId: id },
      select: { matchId: true, isOwnGoal: true },
    }),
    db.playerMatchBonus.findMany({
      where: { playerId: id, match: { status: MatchStatus.CONCLUDED }, bonusType: { code: { not: "MVP" } } },
      select: {
        matchId: true,
        points: true,
        quantity: true,
        bonusType: { select: { name: true } },
      },
    }),
    db.bonusType.findFirst({ where: { code: "MVP" }, select: { name: true, points: true } }),
  ]);

  const mvpBonus = mvpPointsFromBonusType(mvpBonusType);
  const mvpBonusName = "MVP";
  let mvpCount = 0;

  const totalGoals = goals.filter((g) => !g.isOwnGoal).length;
  const totalOwnGoals = goals.filter((g) => g.isOwnGoal).length;
  const pickRate = totalFantasyTeams > 0 ? (player._count.fantasyTeams / totalFantasyTeams) * 100 : 0;

  const matchStats = appearances.map((appearance) => {
    const match = appearance.match;
    const isHome = match.homeTeamId === player.footballTeamId;
    const hs = isHome ? match.homeScore : match.awayScore;
    const as_ = isHome ? match.awayScore : match.homeScore;
    const opponent = isHome
      ? (match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD")
      : (match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD");
    const opponentCountryCode = isHome ? (match.awayTeam?.countryCode ?? null) : (match.homeTeam?.countryCode ?? null);
    const phase = match.group?.name ?? match.knockoutRound?.name ?? null;
    const matchGoals = goals.filter((g) => g.matchId === match.id && !g.isOwnGoal).length;
    const matchBonusEntries = bonuses.filter((b) => b.matchId === match.id);

    const mvpId = getOfficialMvpPlayerId({
      concludedAt: match.concludedAt,
      votes: match.votes,
      mvpOverridePlayerId: match.mvpOverridePlayerId,
      eligiblePlayerIds: match.players.map((p) => p.playerId),
    });
    const isMvp = mvpId === id;
    if (isMvp) mvpCount += 1;

    const matchBonusPoints = roundPoints(
      matchBonusEntries.reduce((sum, b) => sum + Number(b.points), 0) +
      (isMvp ? mvpBonus : 0)
    );

    return {
      matchId: match.id,
      startsAt: match.startsAt.toISOString(),
      isHome,
      opponent,
      opponentCountryCode,
      phase,
      hs,
      as_,
      won: hs !== null && as_ !== null && hs > as_,
      lost: hs !== null && as_ !== null && hs < as_,
      matchGoals,
      matchBonusPoints,
      bonuses: [
        ...matchBonusEntries.map((b) => ({
          name: b.bonusType.name,
          points: Number(b.points),
          quantity: b.quantity,
        })),
        ...(isMvp ? [{ name: mvpBonusName, points: mvpBonus, quantity: 1 }] : []),
      ],
    };
  });

  // Come in scoring: tutti i bonus (non MVP) delle partite concluse + bonus MVP ufficiale.
  const totalBonusPoints = roundPoints(
    bonuses.reduce((sum, b) => sum + Number(b.points), 0) + mvpCount * mvpBonus
  );

  return {
    id: player.id,
    name: player.name,
    role: player.role,
    footballTeam: player.footballTeam,
    totalGoals,
    totalOwnGoals,
    totalBonusPoints,
    presenze: appearances.length,
    pickRate,
    matchStats,
  };
}

export const getPublicFantasyPlayerPickRows = cachePublicData(
  "data.public.players.fantasy-picks.fetch",
  async (): Promise<PublicFantasyPlayerPickRow[]> => {
    const [players, totalFantasyTeams] = await Promise.all([
      db.player.findMany({
        select: {
          id: true,
          name: true,
          role: true,
          footballTeam: {
            select: { name: true, shortName: true, countryCode: true, logoUrl: true },
          },
          fantasyTeams: {
            select: {
              fantasyTeam: {
                select: { id: true, name: true, user: { select: { name: true } } },
              },
            },
          },
        },
      }),
      db.fantasyTeam.count(),
    ]);

    return players
      .map((player) => {
        const pickCount = player.fantasyTeams.length;
        const fantasyTeamRows = player.fantasyTeams
          .map(({ fantasyTeam }) => ({
            id: fantasyTeam.id,
            name: fantasyTeam.name,
            ownerLabel: fantasyTeam.user.name ?? "Utente",
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "it"));

        return {
          rank: 0,
          playerId: player.id,
          playerName: player.name,
          role: player.role,
          footballTeamName: player.footballTeam.name,
          footballTeamShortName: player.footballTeam.shortName,
          flagSrc: resolveTeamFlag(player.footballTeam),
          pickCount,
          pickRate: totalFantasyTeams > 0 ? (pickCount / totalFantasyTeams) * 100 : 0,
          fantasyTeams: fantasyTeamRows,
        };
      })
      .filter((row) => row.pickCount > 0)
      .sort(
        (a, b) =>
          b.pickCount - a.pickCount ||
          a.playerName.localeCompare(b.playerName, "it") ||
          a.footballTeamName.localeCompare(b.footballTeamName, "it")
      )
      .map((row, index) => ({ ...row, rank: index + 1 }));
  },
  ["data.public.players.fantasy-picks"],
  {
    tags: [PUBLIC_CACHE_TAGS.fantasy, PUBLIC_CACHE_TAGS.fantasyPicks],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
  }
);
