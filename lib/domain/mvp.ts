import { isMvpWindowOpen } from "./vote";

export type MvpVote = { playerId: number };

/** Punti di default per l'MVP ufficiale se il BonusType `MVP` non e configurato. */
export const DEFAULT_MVP_POINTS = 3;

/** Punti MVP dal BonusType `MVP` (se presente), altrimenti DEFAULT_MVP_POINTS. */
export function mvpPointsFromBonusType(
  bonusType: { points: number | string | { toString(): string } } | null | undefined
): number {
  if (!bonusType) return DEFAULT_MVP_POINTS;
  const value = Number(bonusType.points);
  return Number.isFinite(value) ? value : DEFAULT_MVP_POINTS;
}

export type MvpVoteCount = {
  playerId: number;
  votes: number;
};

export type MvpResolution =
  | { status: "open"; playerId: null; voteCounts: MvpVoteCount[] }
  | { status: "no_votes"; playerId: null; voteCounts: MvpVoteCount[] }
  | { status: "tied"; playerId: null; tiedPlayerIds: number[]; voteCounts: MvpVoteCount[] }
  | { status: "resolved"; playerId: number; source: "automatic" | "admin"; voteCounts: MvpVoteCount[] };

export function countMvpVotes(votes: MvpVote[]): MvpVoteCount[] {
  const counts = new Map<number, number>();
  for (const vote of votes) {
    counts.set(vote.playerId, (counts.get(vote.playerId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([playerId, voteCount]) => ({ playerId, votes: voteCount }))
    .sort((a, b) => b.votes - a.votes || a.playerId - b.playerId);
}

export function resolveMvp({
  concludedAt,
  votes,
  mvpOverridePlayerId,
  eligiblePlayerIds,
}: {
  concludedAt: Date | null;
  votes: MvpVote[];
  mvpOverridePlayerId?: number | null;
  eligiblePlayerIds?: number[];
}): MvpResolution {
  // I voti per giocatori non presenti in partita non contano.
  const eligible = eligiblePlayerIds ? new Set(eligiblePlayerIds) : null;
  const countedVotes = eligible ? votes.filter((vote) => eligible.has(vote.playerId)) : votes;
  const voteCounts = countMvpVotes(countedVotes);

  if (!concludedAt) {
    return { status: "no_votes", playerId: null, voteCounts };
  }

  if (isMvpWindowOpen(concludedAt)) {
    return { status: "open", playerId: null, voteCounts };
  }

  if (mvpOverridePlayerId) {
    const validOverride = !eligible || eligible.has(mvpOverridePlayerId);
    if (validOverride) {
      return { status: "resolved", playerId: mvpOverridePlayerId, source: "admin", voteCounts };
    }
  }

  if (voteCounts.length === 0) {
    return { status: "no_votes", playerId: null, voteCounts };
  }

  const topVotes = voteCounts[0].votes;
  const tiedPlayerIds = voteCounts
    .filter((entry) => entry.votes === topVotes)
    .map((entry) => entry.playerId);

  if (tiedPlayerIds.length > 1) {
    return { status: "tied", playerId: null, tiedPlayerIds, voteCounts };
  }

  return { status: "resolved", playerId: voteCounts[0].playerId, source: "automatic", voteCounts };
}

export function getOfficialMvpPlayerId(input: Parameters<typeof resolveMvp>[0]): number | null {
  const resolution = resolveMvp(input);
  return resolution.status === "resolved" ? resolution.playerId : null;
}
