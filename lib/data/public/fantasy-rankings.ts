import "server-only";

import { db } from "@/lib/db";
import {
  computeCurrentPhaseRankings,
  computePhaseRankings,
  computeTeamHistory,
  getLastClosedAt,
  getTeamPhaseBreakdown,
  type RankEntry,
} from "@/lib/scoring";
import { getFantasyRankingSnapshotOrCompute } from "@/lib/fantasy-ranking-snapshot";
import { cachePublicData, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS, revivePublicDates } from "./cache";

export type PublicFantasyRankingPhase = {
  id: number;
  name: string;
};

export type PublicFantasyRankingPageData = {
  phases: PublicFantasyRankingPhase[];
  rankings: RankEntry[];
};

export type PublicFantasyTeamDetail = {
  team: {
    id: number;
    name: string;
    captainPlayerId: number;
    ownerLabel: string;
    players: Array<{
      player: {
        id: number;
        name: string;
        role: string;
        footballTeam: {
          name: string;
          shortName: string | null;
          countryCode: string | null;
          logoUrl: string | null;
        };
      };
    }>;
  };
  history: Awaited<ReturnType<typeof computeTeamHistory>>;
  phaseBreakdown: Awaited<ReturnType<typeof getTeamPhaseBreakdown>>;
  totalPoints: number;
  lastClosedAt: Date | null;
};

export const getPublicFantasyRankingPhases = cachePublicData(
  "data.public.fantasy-rankings.phases.fetch",
  async (): Promise<PublicFantasyRankingPhase[]> =>
    db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ["data.public.fantasy-rankings.phases"],
  {
    tags: [PUBLIC_CACHE_TAGS.fantasy, PUBLIC_CACHE_TAGS.fantasyRankings],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
  }
);

export const getPublicFantasyRankingPageData = cachePublicData(
  "data.public.fantasy-rankings.page.fetch",
  async (selected: string): Promise<PublicFantasyRankingPageData> => {
    const phases = await db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    });

    let rankings: RankEntry[];
    if (selected === "corrente") {
      rankings = await computeCurrentPhaseRankings();
    } else if (/^\d+$/.test(selected) && phases.some((phase) => String(phase.id) === selected)) {
      rankings = await computePhaseRankings(Number(selected));
    } else {
      rankings = await getFantasyRankingSnapshotOrCompute();
    }

    return { phases, rankings };
  },
  ["data.public.fantasy-rankings.page"],
  {
    tags: [PUBLIC_CACHE_TAGS.fantasy, PUBLIC_CACHE_TAGS.fantasyRankings],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
  }
);

export const getPublicFantasyTeamRankings = cachePublicData(
  "data.public.fantasy-rankings.teams.fetch",
  async (): Promise<RankEntry[]> => getFantasyRankingSnapshotOrCompute(),
  ["data.public.fantasy-rankings.teams"],
  {
    tags: [PUBLIC_CACHE_TAGS.fantasy, PUBLIC_CACHE_TAGS.fantasyRankings],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
  }
);

export const getPublicFantasyTeamDetail = cachePublicData(
  "data.public.fantasy-rankings.team-detail.fetch",
  async (teamId: number): Promise<PublicFantasyTeamDetail | null> => {
    const team = await db.fantasyTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        captainPlayerId: true,
        user: { select: { name: true } },
        players: {
          select: {
            player: {
              select: {
                id: true,
                name: true,
                role: true,
                footballTeam: { select: { name: true, shortName: true, countryCode: true, logoUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!team) return null;

    const [history, phaseBreakdown, lastClosedAt] = await Promise.all([
      computeTeamHistory(teamId),
      getTeamPhaseBreakdown(teamId),
      getLastClosedAt(),
    ]);
    const totalPoints = phaseBreakdown.reduce((sum, phase) => sum + phase.points, 0);

    return {
      team: {
        id: team.id,
        name: team.name,
        captainPlayerId: team.captainPlayerId,
        ownerLabel: team.user.name ?? "Utente",
        players: team.players,
      },
      history,
      phaseBreakdown,
      totalPoints,
      lastClosedAt,
    };
  },
  ["data.public.fantasy-rankings.team-detail"],
  {
    tags: [PUBLIC_CACHE_TAGS.fantasy, PUBLIC_CACHE_TAGS.fantasyRankings],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
    hydrate: revivePublicDates,
  }
);
