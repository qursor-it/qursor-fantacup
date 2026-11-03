import { describe, expect, it } from "vitest";
import { buildGroupStandings, compareStandings, type GroupStandingRow } from "./standings";

function team(id: number, name: string) {
  return {
    footballTeamId: id,
    footballTeam: {
      name,
      shortName: name.slice(0, 3).toUpperCase(),
      countryCode: null,
      logoUrl: null,
    },
  };
}

function match(
  homeTeamId: number | null,
  awayTeamId: number | null,
  homeScore: number | null,
  awayScore: number | null
) {
  return { homeTeamId, awayTeamId, homeScore, awayScore };
}

function row(rows: GroupStandingRow[], teamId: number) {
  const found = rows.find((entry) => entry.teamId === teamId);
  if (!found) throw new Error(`team ${teamId} not found`);
  return found;
}

describe("buildGroupStandings", () => {
  it("assegna i punti da vittoria, pareggio e sconfitta", () => {
    const rows = buildGroupStandings(
      [team(1, "Alfa"), team(2, "Beta"), team(3, "Charlie"), team(4, "Delta")],
      [match(1, 2, 2, 1), match(3, 4, 0, 0)]
    );

    expect(row(rows, 1)).toMatchObject({ played: 1, won: 1, drawn: 0, lost: 0, points: 3 });
    expect(row(rows, 2)).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: 0 });
    expect(row(rows, 3)).toMatchObject({ played: 1, won: 0, drawn: 1, lost: 0, points: 1 });
    expect(row(rows, 4)).toMatchObject({ played: 1, won: 0, drawn: 1, lost: 0, points: 1 });
  });

  it("calcola differenza reti e gol fatti da entrambi i lati", () => {
    const rows = buildGroupStandings(
      [team(1, "Alfa"), team(2, "Beta")],
      [match(1, 2, 3, 1)]
    );

    expect(row(rows, 1)).toMatchObject({ goalsFor: 3, goalsAgainst: 1, goalDiff: 2 });
    expect(row(rows, 2)).toMatchObject({ goalsFor: 1, goalsAgainst: 3, goalDiff: -2 });
  });

  it("ordina per differenza reti a parità di punti", () => {
    const rows = buildGroupStandings(
      [team(1, "Alfa"), team(2, "Beta"), team(3, "Charlie"), team(4, "Delta")],
      [match(1, 4, 1, 0), match(2, 4, 4, 0), match(3, 4, 2, 0)]
    );

    expect(rows.map((entry) => entry.teamId)).toEqual([2, 3, 1, 4]);
  });

  it("risolve un pari a tre squadre con differenza reti, gol fatti e nome", () => {
    const rows = buildGroupStandings(
      [team(1, "Papa"), team(2, "Quebec"), team(3, "Romeo"), team(4, "Sierra")],
      [match(1, 4, 3, 1), match(2, 4, 2, 1), match(3, 4, 4, 2)]
    );

    // Tutte e tre a 3 punti: Romeo (DR +2, GF 4), Papa (DR +2, GF 3), Quebec (DR +1).
    expect(rows.map((entry) => entry.teamId)).toEqual([3, 1, 2, 4]);
  });

  it("ordina alfabeticamente le squadre senza partite, tutte a zero", () => {
    const rows = buildGroupStandings(
      [team(1, "Zeta"), team(2, "Alfa")],
      []
    );

    expect(rows.map((entry) => entry.teamId)).toEqual([2, 1]);
    for (const entry of rows) {
      expect(entry).toMatchObject({
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
      });
    }
  });

  it("ignora partite senza risultato o con squadre TBD", () => {
    const rows = buildGroupStandings(
      [team(1, "Alfa"), team(2, "Beta")],
      [match(1, null, 3, 0), match(1, 2, null, null)]
    );

    expect(row(rows, 1)).toMatchObject({ played: 0, points: 0 });
    expect(row(rows, 2)).toMatchObject({ played: 0, points: 0 });
  });
});

describe("compareStandings", () => {
  const name = (entry: { name: string }) => entry.name;

  it("a parità di punti, differenza reti e gol fatti usa il nome (locale it)", () => {
    const rows = [
      { name: "Zeta", points: 6, goalDiff: 2, goalsFor: 3 },
      { name: "Alfa", points: 6, goalDiff: 2, goalsFor: 3 },
      { name: "Beta", points: 6, goalDiff: 2, goalsFor: 3 },
    ];

    expect([...rows].sort((a, b) => compareStandings(a, b, name)).map(name)).toEqual([
      "Alfa",
      "Beta",
      "Zeta",
    ]);
  });
});
