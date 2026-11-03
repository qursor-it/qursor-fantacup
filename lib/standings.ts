import { db } from "./db";
import { measureServerTiming } from "./perf";

// ─── Tiebreak condiviso ──────────────────────────────────────────────────────

type ComparableStanding = { points: number; goalDiff: number; goalsFor: number };

/**
 * Ordinamento unico per tutte le classifiche: punti, differenza reti, gol fatti,
 * nome (locale it).
 */
export function compareStandings<T extends ComparableStanding>(
  a: T,
  b: T,
  getName: (row: T) => string
): number {
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    getName(a).localeCompare(getName(b), "it")
  );
}

// ─── Sync helper (dati già fetchati dalla pagina) ────────────────────────────

export type GroupStandingRow = {
  teamId: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  qualified: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

type TeamEntry = {
  footballTeamId: number;
  qualified?: boolean;
  footballTeam: {
    name: string;
    shortName: string | null;
    countryCode: string | null;
    logoUrl: string | null;
  };
};

type MatchEntry = {
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

export function buildGroupStandings(teams: TeamEntry[], matches: MatchEntry[]): GroupStandingRow[] {
  return measureServerTiming("standings.buildGroupStandings", () => {
    const map = new Map<number, GroupStandingRow>();
    for (const gt of teams) {
      map.set(gt.footballTeamId, {
        teamId: gt.footballTeamId,
        name: gt.footballTeam.name,
        shortName: gt.footballTeam.shortName,
        countryCode: gt.footballTeam.countryCode,
        logoUrl: gt.footballTeam.logoUrl,
        qualified: gt.qualified ?? false,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      });
    }
    for (const m of matches) {
      if (!m.homeTeamId || !m.awayTeamId || m.homeScore === null || m.awayScore === null) continue;
      const hs = m.homeScore;
      const as_ = m.awayScore;
      const home = map.get(m.homeTeamId);
      const away = map.get(m.awayTeamId);
      if (home) {
        home.played++; home.goalsFor += hs; home.goalsAgainst += as_; home.goalDiff += hs - as_;
        if (hs > as_) { home.won++; home.points += 3; }
        else if (hs === as_) { home.drawn++; home.points += 1; }
        else home.lost++;
      }
      if (away) {
        away.played++; away.goalsFor += as_; away.goalsAgainst += hs; away.goalDiff += as_ - hs;
        if (as_ > hs) { away.won++; away.points += 3; }
        else if (hs === as_) { away.drawn++; away.points += 1; }
        else away.lost++;
      }
    }
    return [...map.values()].sort((a, b) => compareStandings(a, b, (row) => row.name));
  });
}

// ─── Async helpers (fanno le proprie query DB) ───────────────────────────────

export type StandingEntry = {
  groupSlug?: string; // present when computing per-group standings
  rank: number;
  teamId: number;
  teamName: string;
  shortName: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

export async function computeStandings(): Promise<StandingEntry[]> {
  return measureServerTiming("standings.computeStandings", async () => {
    const [matches, allTeams] = await Promise.all([
      db.match.findMany({
        where: {
          status: "CONCLUDED",
          homeScore: { not: null },
          awayScore: { not: null },
        },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { id: true, name: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, shortName: true } },
        },
      }),
      db.footballTeam.findMany({ select: { id: true, name: true, shortName: true } }),
    ]);

    const map = new Map<number, Omit<StandingEntry, "rank">>();

    const ensure = (team: { id: number; name: string; shortName: string | null }) => {
      if (!map.has(team.id)) {
        map.set(team.id, {
          teamId: team.id,
          teamName: team.name,
          shortName: team.shortName,
          played: 0, won: 0, drawn: 0, lost: 0,
          goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        });
      }
      return map.get(team.id)!;
    };

    // Seed all teams (even those without matches)
    for (const t of allTeams) ensure(t);

    for (const m of matches) {
      if (!m.homeTeam || !m.awayTeam) continue; // skip TBD knockout matches
      const hs = m.homeScore!;
      const as_ = m.awayScore!;
      const home = ensure(m.homeTeam);
      const away = ensure(m.awayTeam);

      home.played++; away.played++;
      home.goalsFor += hs; home.goalsAgainst += as_;
      away.goalsFor += as_; away.goalsAgainst += hs;

      if (hs > as_) {
        home.won++; home.points += 3; away.lost++;
      } else if (hs < as_) {
        away.won++; away.points += 3; home.lost++;
      } else {
        home.drawn++; home.points += 1;
        away.drawn++; away.points += 1;
      }
    }

    const entries = [...map.values()];
    for (const e of entries) e.goalDiff = e.goalsFor - e.goalsAgainst;

    entries.sort((a, b) => compareStandings(a, b, (row) => row.teamName));

    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  });
}

/** Classifica di un singolo girone — solo partite CONCLUDED con groupId = groupId */
export async function computeGroupStandings(groupId: number): Promise<StandingEntry[]> {
  const [matches, groupTeams] = await Promise.all([
    db.match.findMany({
      where: {
        groupId,
        status: "CONCLUDED",
        homeScore: { not: null },
        awayScore: { not: null },
      },
      select: {
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
        homeTeam: { select: { id: true, name: true, shortName: true } },
        awayTeam: { select: { id: true, name: true, shortName: true } },
      },
    }),
    db.groupTeam.findMany({
      where: { groupId },
      select: { footballTeam: { select: { id: true, name: true, shortName: true } } },
    }),
  ]);

  const map = new Map<number, Omit<StandingEntry, "rank">>();

  const ensure = (team: { id: number; name: string; shortName: string | null }) => {
    if (!map.has(team.id)) {
      map.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        shortName: team.shortName,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      });
    }
    return map.get(team.id)!;
  };

  // Seed solo le squadre assegnate al girone: le squadre non membre vengono ignorate
  // (come in buildGroupStandings), anche se compaiono in una partita del girone.
  for (const gt of groupTeams) ensure(gt.footballTeam);

  for (const m of matches) {
    if (!m.homeTeam || !m.awayTeam) continue; // skip TBD knockout matches
    const hs = m.homeScore!;
    const as_ = m.awayScore!;
    const home = map.get(m.homeTeam.id);
    const away = map.get(m.awayTeam.id);

    if (home) {
      home.played++;
      home.goalsFor += hs; home.goalsAgainst += as_;
      if (hs > as_) { home.won++; home.points += 3; }
      else if (hs === as_) { home.drawn++; home.points += 1; }
      else home.lost++;
    }
    if (away) {
      away.played++;
      away.goalsFor += as_; away.goalsAgainst += hs;
      if (as_ > hs) { away.won++; away.points += 3; }
      else if (hs === as_) { away.drawn++; away.points += 1; }
      else away.lost++;
    }
  }

  const entries = [...map.values()];
  for (const e of entries) e.goalDiff = e.goalsFor - e.goalsAgainst;

  entries.sort((a, b) => compareStandings(a, b, (row) => row.teamName));

  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}

