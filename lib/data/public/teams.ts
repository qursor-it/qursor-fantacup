import "server-only";

import { db } from "@/lib/db";
import { buildGroupStandings, type GroupStandingRow } from "@/lib/standings";
import type { PublicMatchRow } from "./matches";
import { COUNTED_GOAL_WHERE } from "./players";
import { cachePublicData, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL_SECONDS, revivePublicDates } from "./cache";

export type PublicFootballTeamSummary = {
  id: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  logoUrl: string | null;
};

export type PublicFootballTeamDetail = {
  team: PublicFootballTeamSummary & {
    players: Array<{ id: number; name: string; role: string }>;
  };
  nextMatch: PublicMatchRow | null;
  teamMatches: PublicMatchRow[];
  scorerRows: Array<{ name: string; goals: number }>;
  group: {
    id: number;
    name: string;
    rows: GroupStandingRow[];
  } | null;
};

export const getPublicFootballTeams = cachePublicData(
  "data.public.teams.index.fetch",
  async (): Promise<PublicFootballTeamSummary[]> => db.footballTeam.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true },
    }),
  ["data.public.teams.index"],
  {
    tags: [PUBLIC_CACHE_TAGS.dcup, PUBLIC_CACHE_TAGS.dcupTeams],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.stable,
  }
);

export const getPublicFootballTeamDetail = cachePublicData(
  "data.public.teams.detail.fetch",
  async (teamId: number): Promise<PublicFootballTeamDetail | null> => {
    const [team, nextMatch, teamGroup, scorerGroups, teamMatches] = await Promise.all([
      db.footballTeam.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
          shortName: true,
          countryCode: true,
          logoUrl: true,
          players: {
            orderBy: [{ role: "desc" }, { name: "asc" }],
            select: { id: true, name: true, role: true },
          },
        },
      }),
      db.match.findFirst({
        where: {
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          status: "SCHEDULED",
        },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          status: true,
          homeScore: true,
          awayScore: true,
          homeSeed: true,
          awaySeed: true,
          homeTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
          group: { select: { name: true, slug: true } },
          knockoutRound: { select: { name: true } },
        },
      }),
      db.group.findFirst({
        where: { teams: { some: { footballTeamId: teamId } } },
        select: {
          id: true,
          name: true,
          teams: {
            select: {
              footballTeamId: true,
              qualified: true,
              footballTeam: {
                select: { name: true, shortName: true, countryCode: true, logoUrl: true },
              },
            },
          },
          matches: {
            where: { status: "CONCLUDED", homeScore: { not: null }, awayScore: { not: null } },
            select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
          },
        },
      }),
      db.matchGoal.groupBy({
        by: ["scorerId"],
        where: { ...COUNTED_GOAL_WHERE, scorer: { footballTeamId: teamId } },
        _count: { scorerId: true },
        orderBy: { _count: { scorerId: "desc" } },
        take: 5,
      }),
      db.match.findMany({
        where: {
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
          status: "CONCLUDED",
        },
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          startsAt: true,
          status: true,
          homeScore: true,
          awayScore: true,
          homeSeed: true,
          awaySeed: true,
          homeTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
          awayTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
          group: { select: { name: true, slug: true } },
          knockoutRound: { select: { name: true } },
        },
      }),
    ]);

    if (!team) return null;

    const scorerIds = scorerGroups.map((scorer) => scorer.scorerId);
    const scorerPlayers = scorerIds.length > 0
      ? await db.player.findMany({
          where: { id: { in: scorerIds } },
          select: { id: true, name: true },
        })
      : [];
    const scorerMap = new Map(scorerPlayers.map((player) => [player.id, player.name]));
    const scorerRows = scorerGroups.map((scorer) => ({
      name: scorerMap.get(scorer.scorerId) ?? "-",
      goals: scorer._count.scorerId,
    }));

    return {
      team,
      nextMatch,
      teamMatches,
      scorerRows,
      group: teamGroup
        ? {
            id: teamGroup.id,
            name: teamGroup.name,
            rows: buildGroupStandings(teamGroup.teams, teamGroup.matches),
          }
        : null,
    };
  },
  ["data.public.teams.detail"],
  {
    tags: [
      PUBLIC_CACHE_TAGS.dcup,
      PUBLIC_CACHE_TAGS.dcupMatches,
      PUBLIC_CACHE_TAGS.dcupScorers,
      PUBLIC_CACHE_TAGS.dcupStandings,
      PUBLIC_CACHE_TAGS.dcupTeams,
    ],
    revalidate: PUBLIC_CACHE_TTL_SECONDS.live,
    hydrate: revivePublicDates,
  }
);
