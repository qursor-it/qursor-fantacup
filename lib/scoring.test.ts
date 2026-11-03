import { describe, expect, it } from "vitest";
import { MVP_WINDOW_MS } from "./domain/vote";
import {
  accumulatePlayerTotals,
  buildPhaseRosterWindows,
  combinePhasePoints,
  computeMvpWinnerId,
  findRosterWindow,
  rankFromPoints,
  teamPointsFromPlayerTotals,
  teamPointsWithStartDate,
  type FantasyTeamMeta,
} from "./scoring";

describe("computeMvpWinnerId", () => {
  it("returns null when there are no votes", () => {
    expect(computeMvpWinnerId([])).toBeNull();
  });

  it("returns the most voted player id", () => {
    expect(
      computeMvpWinnerId([
        { playerId: 4 },
        { playerId: 2 },
        { playerId: 4 },
        { playerId: 1 },
      ])
    ).toBe(4);
  });

  it("returns null when top votes are tied", () => {
    expect(
      computeMvpWinnerId([
        { playerId: 8 },
        { playerId: 3 },
        { playerId: 8 },
        { playerId: 3 },
      ])
    ).toBeNull();
  });
});

describe("accumulatePlayerTotals", () => {
  const closedAt = new Date(Date.now() - MVP_WINDOW_MS - 60_000);
  const openAt = new Date();

  it("aggregates bonus and official MVP points across matches", () => {
    const totals = accumulatePlayerTotals(
      [
        {
          bonuses: [
            { playerId: 1, points: 2 },
            { playerId: 1, points: 1.5 },
            { playerId: 2, points: -1 },
          ],
          goals: [],
          votes: [{ playerId: 1 }, { playerId: 3 }, { playerId: 1 }],
          concludedAt: closedAt,
          players: [{ playerId: 1 }, { playerId: 2 }, { playerId: 3 }],
        },
        {
          bonuses: [
            { playerId: 2, points: 3 },
            { playerId: 3, points: 0.5 },
          ],
          goals: [],
          votes: [{ playerId: 3 }],
          concludedAt: closedAt,
          players: [{ playerId: 2 }, { playerId: 3 }],
        },
      ],
      5
    );

    expect(totals.get(1)).toBe(8.5);
    expect(totals.get(2)).toBe(2);
    expect(totals.get(3)).toBe(5.5);
  });

  it("does not assign MVP points while the vote window is open", () => {
    const totals = accumulatePlayerTotals(
      [{
        bonuses: [],
        goals: [],
        votes: [{ playerId: 1 }, { playerId: 1 }],
        concludedAt: openAt,
        players: [{ playerId: 1 }],
      }],
      5
    );

    expect(totals.get(1)).toBeUndefined();
  });

  it("does not assign MVP points when final votes are tied without admin override", () => {
    const totals = accumulatePlayerTotals(
      [{
        bonuses: [],
        goals: [],
        votes: [{ playerId: 1 }, { playerId: 2 }],
        concludedAt: closedAt,
        players: [{ playerId: 1 }, { playerId: 2 }],
      }],
      5
    );

    expect(totals.get(1)).toBeUndefined();
    expect(totals.get(2)).toBeUndefined();
  });

  it("assigns MVP points to the admin override after the window closes", () => {
    const totals = accumulatePlayerTotals(
      [{
        bonuses: [],
        goals: [],
        votes: [{ playerId: 1 }, { playerId: 2 }],
        concludedAt: closedAt,
        mvpOverridePlayerId: 2,
        players: [{ playerId: 1 }, { playerId: 2 }],
      }],
      5
    );

    expect(totals.get(1)).toBeUndefined();
    expect(totals.get(2)).toBe(5);
  });

  it("does not assign MVP points when there are no votes", () => {
    const totals = accumulatePlayerTotals(
      [{
        bonuses: [],
        goals: [],
        votes: [],
        concludedAt: closedAt,
        players: [{ playerId: 1 }],
      }],
      5
    );

    expect(totals.get(1)).toBeUndefined();
  });

  it("does not assign points for goals (goals are tracked in MatchGoal but scored via bonus types)", () => {
    const totals = accumulatePlayerTotals(
      [{
        bonuses: [],
        goals: [{ scorerId: 1, isOwnGoal: false }, { scorerId: 1, isOwnGoal: false }],
        votes: [],
        concludedAt: closedAt,
        players: [{ playerId: 1 }],
      }],
      5
    );
    expect(totals.get(1)).toBeUndefined();
  });
});

describe("teamPointsFromPlayerTotals", () => {
  const team = { captainPlayerId: 1, players: [1, 2, 3, 4, 5].map((playerId) => ({ playerId })) };

  it("sums the roster and doubles the captain's points", () => {
    const totals = new Map([
      [1, 5], // captain
      [2, 3],
      [3, 2],
      [4, 1],
      [5, 4],
    ]);
    // roster 15 + captain 5 (counted again) = 20
    expect(teamPointsFromPlayerTotals(team, totals)).toBe(20);
  });

  it("treats players without totals as 0", () => {
    const totals = new Map([[1, 5]]); // only the captain scored
    // roster 5 + captain 5 = 10
    expect(teamPointsFromPlayerTotals(team, totals)).toBe(10);
  });

  it("adds nothing extra when the captain has no points", () => {
    const totals = new Map([
      [2, 3],
      [3, 2],
    ]);
    // roster 5 + captain(1)=0 = 5
    expect(teamPointsFromPlayerTotals(team, totals)).toBe(5);
  });

  it("supports negative totals (malus)", () => {
    const totals = new Map([
      [1, -1], // captain
      [2, 2],
    ]);
    // roster (-1 + 2) = 1 + captain (-1) = 0
    expect(teamPointsFromPlayerTotals(team, totals)).toBe(0);
  });
});

describe("combinePhasePoints", () => {
  it("sums frozen phases with the current phase per team", () => {
    const frozen = [
      { fantasyTeamId: 1, points: 10 }, // fase 1
      { fantasyTeamId: 1, points: 7 }, // fase 2
      { fantasyTeamId: 2, points: 4 },
    ];
    const current = new Map([
      [1, 3],
      [2, 6],
    ]);
    const totals = combinePhasePoints(frozen, current);
    expect(totals.get(1)).toBe(20); // 10 + 7 + 3
    expect(totals.get(2)).toBe(10); // 4 + 6
  });

  it("includes teams present only in frozen phases", () => {
    const totals = combinePhasePoints([{ fantasyTeamId: 9, points: 12 }], new Map());
    expect(totals.get(9)).toBe(12);
  });

  it("includes teams present only in the current phase (new teams)", () => {
    const totals = combinePhasePoints([], new Map([[5, 8]]));
    expect(totals.get(5)).toBe(8);
  });

  it("equals the current phase when there are no frozen phases", () => {
    const current = new Map([
      [1, 5],
      [2, 9],
    ]);
    const totals = combinePhasePoints([], current);
    expect([...totals.entries()].sort()).toEqual([...current.entries()].sort());
  });
});

describe("rankFromPoints", () => {
  const meta = (id: number, name: string): FantasyTeamMeta => ({
    id,
    name,
    captainPlayerId: 0,
    players: [],
    user: { id, name: null },
  });

  it("sorts by points desc and assigns sequential ranks", () => {
    const teams = [meta(1, "Bravo"), meta(2, "Alpha"), meta(3, "Charlie")];
    const points = new Map([
      [1, 12],
      [2, 20],
      [3, 5],
    ]);
    const ranked = rankFromPoints(teams, points);
    expect(ranked.map((r) => [r.fantasyTeamName, r.rank, r.totalPoints])).toEqual([
      ["Alpha", 1, 20],
      ["Bravo", 2, 12],
      ["Charlie", 3, 5],
    ]);
  });

  it("breaks ties by team name (it locale)", () => {
    const teams = [meta(1, "Zeta"), meta(2, "Alpha")];
    const points = new Map([
      [1, 10],
      [2, 10],
    ]);
    const ranked = rankFromPoints(teams, points);
    expect(ranked.map((r) => r.fantasyTeamName)).toEqual(["Alpha", "Zeta"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("uses standard competition ranking for ties (1, 1, 3)", () => {
    const teams = [meta(1, "A"), meta(2, "B"), meta(3, "C"), meta(4, "D")];
    const points = new Map([
      [1, 10],
      [2, 10],
      [3, 7],
      [4, 7],
    ]);
    expect(rankFromPoints(teams, points).map((r) => r.rank)).toEqual([1, 1, 3, 3]);
  });

  it("rounds points to 2 decimals so float noise does not break ties", () => {
    const teams = [meta(1, "A"), meta(2, "B")];
    const points = new Map([
      [1, 0.1 + 0.2],
      [2, 0.3],
    ]);
    const ranked = rankFromPoints(teams, points);
    expect(ranked.map((r) => r.totalPoints)).toEqual([0.3, 0.3]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("treats teams without a points entry as 0", () => {
    const teams = [meta(1, "Alpha"), meta(2, "Bravo")];
    const ranked = rankFromPoints(teams, new Map([[1, 4]]));
    expect(ranked.find((r) => r.fantasyTeamName === "Bravo")?.totalPoints).toBe(0);
    expect(ranked.map((r) => r.fantasyTeamName)).toEqual(["Alpha", "Bravo"]);
  });
});

describe("buildPhaseRosterWindows", () => {
  const currentRoster = { rosterPlayerIds: [10, 20, 30, 40, 50], captainPlayerId: 10 };

  it("returns a single open window with the current roster when there are no phases", () => {
    const windows = buildPhaseRosterWindows([], currentRoster);
    expect(windows).toEqual([
      { startsAt: null, closedAt: null, rosterPlayerIds: currentRoster.rosterPlayerIds, captainPlayerId: currentRoster.captainPlayerId },
    ]);
  });

  it("uses the frozen roster/captain for a closed phase and appends an open window for the current phase", () => {
    const closedAt = new Date("2026-01-15T00:00:00Z");
    const windows = buildPhaseRosterWindows(
      [{ startsAt: null, closedAt, score: { rosterPlayerIds: [1, 2, 3, 4, 5], captainPlayerId: 1 } }],
      currentRoster
    );
    expect(windows).toEqual([
      { startsAt: null, closedAt, rosterPlayerIds: [1, 2, 3, 4, 5], captainPlayerId: 1 },
      { startsAt: closedAt, closedAt: null, rosterPlayerIds: currentRoster.rosterPlayerIds, captainPlayerId: currentRoster.captainPlayerId },
    ]);
  });

  it("treats a phase without a score row (squadra non ancora esistente) as an empty roster", () => {
    const closedAt = new Date("2026-01-15T00:00:00Z");
    const windows = buildPhaseRosterWindows([{ startsAt: null, closedAt, score: null }], currentRoster);
    expect(windows[0]).toEqual({ startsAt: null, closedAt, rosterPlayerIds: [], captainPlayerId: null });
  });

  it("chains successive phases using each phase's own boundaries", () => {
    const closed1 = new Date("2026-01-15T00:00:00Z");
    const closed2 = new Date("2026-02-15T00:00:00Z");
    const windows = buildPhaseRosterWindows(
      [
        { startsAt: null, closedAt: closed1, score: { rosterPlayerIds: [1, 2], captainPlayerId: 1 } },
        { startsAt: closed1, closedAt: closed2, score: { rosterPlayerIds: [3, 4], captainPlayerId: 3 } },
      ],
      currentRoster
    );
    expect(windows.map((w) => [w.startsAt, w.closedAt])).toEqual([
      [null, closed1],
      [closed1, closed2],
      [closed2, null],
    ]);
  });
});

describe("teamPointsWithStartDate", () => {
  const makeTeam = (createdAt: Date) => ({
    createdAt,
    captainPlayerId: 1,
    players: [1, 2, 3].map((playerId) => ({ playerId })),
  });

  const makeContrib = (concludedAt: Date | null, pid1: number, pts1: number) => ({
    concludedAt,
    points: new Map<number, number>([[pid1, pts1]]),
  });

  it("conta tutte le partite se la squadra è creata prima di tutte", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const match1 = makeContrib(new Date("2026-01-10T00:00:00Z"), 1, 5);
    const match2 = makeContrib(new Date("2026-01-20T00:00:00Z"), 2, 3);
    // team: captain=1 (doubles), players [1,2,3]
    // totals: p1=5, p2=3
    // rosterTotal(5+3+0)=8; captainExtra(5)=5 → total 13
    expect(teamPointsWithStartDate(makeTeam(createdAt), [match1, match2])).toBe(13);
  });

  it("esclude le partite con concludedAt < createdAt", () => {
    const createdAt = new Date("2026-01-15T00:00:00Z");
    const before = makeContrib(new Date("2026-01-10T00:00:00Z"), 1, 10);
    const after = makeContrib(new Date("2026-01-20T00:00:00Z"), 2, 4);
    // only 'after' counts: p2=4, p1=0
    // rosterTotal(0+4+0)=4; captainExtra(0)=0 → total 4
    expect(teamPointsWithStartDate(makeTeam(createdAt), [before, after])).toBe(4);
  });

  it("include la partita con concludedAt == createdAt (confine incluso)", () => {
    const createdAt = new Date("2026-01-15T00:00:00Z");
    const exact = makeContrib(createdAt, 1, 7);
    // p1=7, captain doubles → rosterTotal(7+0+0)=7; captainExtra=7 → total 14
    expect(teamPointsWithStartDate(makeTeam(createdAt), [exact])).toBe(14);
  });

  it("raddoppia il capitano solo sulle partite conteggiate", () => {
    const createdAt = new Date("2026-01-15T00:00:00Z");
    const before = makeContrib(new Date("2026-01-10T00:00:00Z"), 1, 100); // captain scores 100 before registration
    const after = makeContrib(new Date("2026-01-20T00:00:00Z"), 1, 3);   // captain scores 3 after
    // only 'after' counts: p1=3
    // rosterTotal(3+0+0)=3; captainExtra(3)=3 → total 6
    expect(teamPointsWithStartDate(makeTeam(createdAt), [before, after])).toBe(6);
  });
});

describe("findRosterWindow", () => {
  const closed1 = new Date("2026-01-15T00:00:00Z");
  const windows = buildPhaseRosterWindows(
    [{ startsAt: null, closedAt: closed1, score: { rosterPlayerIds: [1, 2], captainPlayerId: 1 } }],
    { rosterPlayerIds: [3, 4], captainPlayerId: 3 }
  );

  it("returns the frozen phase window for matches concluded before the snapshot", () => {
    const before = new Date(closed1.getTime() - 60_000);
    expect(findRosterWindow(windows, before).rosterPlayerIds).toEqual([1, 2]);
  });

  it("returns the current phase window for matches concluded exactly at the snapshot boundary", () => {
    expect(findRosterWindow(windows, closed1).rosterPlayerIds).toEqual([3, 4]);
  });

  it("returns the current phase window for matches concluded after the snapshot", () => {
    const after = new Date(closed1.getTime() + 60_000);
    expect(findRosterWindow(windows, after).rosterPlayerIds).toEqual([3, 4]);
  });

  it("falls back to the earliest window for a null concludedAt", () => {
    expect(findRosterWindow(windows, null).rosterPlayerIds).toEqual([1, 2]);
  });
});
