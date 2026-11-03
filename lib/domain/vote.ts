import { tournament } from "@/tournaments";

export type VoteValidationError =
  | "PLAYER_NOT_IN_MATCH"
  | "VOTING_WINDOW_CLOSED"
  | "ALREADY_VOTED";

export const MVP_WINDOW_MS = tournament.rules.mvpWindowMinutes * 60 * 1000;

export function isMvpWindowOpen(concludedAt: Date | null): boolean {
  if (!concludedAt) return false;
  return Date.now() - concludedAt.getTime() < MVP_WINDOW_MS;
}

export function validateVote({
  playerIds,
  candidatePlayerId,
  concludedAt,
  alreadyVoted,
}: {
  playerIds: number[];
  candidatePlayerId: number;
  concludedAt: Date | null;
  alreadyVoted: boolean;
}): VoteValidationError | null {
  if (!isMvpWindowOpen(concludedAt)) return "VOTING_WINDOW_CLOSED";
  if (alreadyVoted) return "ALREADY_VOTED";
  if (!playerIds.includes(candidatePlayerId)) return "PLAYER_NOT_IN_MATCH";
  return null;
}
