import { describe, expect, it } from "vitest";
import { computeScoreFromGoals } from "./goals";

const HOME_ID = 1;
const AWAY_ID = 2;

describe("computeScoreFromGoals", () => {
  it("returns 0-0 when there are no goals", () => {
    expect(computeScoreFromGoals([], HOME_ID, AWAY_ID)).toEqual({ homeScore: 0, awayScore: 0 });
  });

  it("counts normal goals for the scorer's team", () => {
    const goals = [
      { isOwnGoal: false, scorer: { footballTeamId: HOME_ID } },
      { isOwnGoal: false, scorer: { footballTeamId: HOME_ID } },
      { isOwnGoal: false, scorer: { footballTeamId: AWAY_ID } },
    ];

    expect(computeScoreFromGoals(goals, HOME_ID, AWAY_ID)).toEqual({ homeScore: 2, awayScore: 1 });
  });

  it("counts an own goal for the opponent", () => {
    const goals = [
      { isOwnGoal: true, scorer: { footballTeamId: HOME_ID } },
      { isOwnGoal: true, scorer: { footballTeamId: AWAY_ID } },
    ];

    expect(computeScoreFromGoals(goals, HOME_ID, AWAY_ID)).toEqual({ homeScore: 1, awayScore: 1 });
  });
});
