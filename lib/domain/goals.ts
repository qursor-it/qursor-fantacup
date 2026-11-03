export type GoalForScore = {
  isOwnGoal: boolean;
  scorer: { footballTeamId: number };
};

export function computeScoreFromGoals(
  goals: GoalForScore[],
  homeTeamId: number,
  awayTeamId: number
) {
  let homeScore = 0;
  let awayScore = 0;

  for (const goal of goals) {
    const scorerIsHome = goal.scorer.footballTeamId === homeTeamId;
    const scorerIsAway = goal.scorer.footballTeamId === awayTeamId;
    if (!scorerIsHome && !scorerIsAway) continue;

    const scoringTeamIsHome = goal.isOwnGoal ? !scorerIsHome : scorerIsHome;
    if (scoringTeamIsHome) homeScore++;
    else awayScore++;
  }

  return { homeScore, awayScore };
}
