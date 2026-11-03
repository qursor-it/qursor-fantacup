import { PlayerRole } from "@prisma/client";

import { tournament } from "@/tournaments";

const REQUIRED_GK = tournament.rules.goalkeepers;
const REQUIRED_PLAYERS = tournament.rules.outfieldPlayers;
export const ROSTER_SIZE = REQUIRED_GK + REQUIRED_PLAYERS;

export type RosterPlayer = {
  playerId: number;
  role: PlayerRole;
  footballTeamId: number;
};

export type RosterValidationError =
  | "WRONG_SIZE"
  | "WRONG_GK_COUNT"
  | "WRONG_PLAYER_COUNT"
  | "DUPLICATE_TEAM"
  | "CAPTAIN_NOT_IN_ROSTER";

export function validateRoster(
  players: RosterPlayer[],
  captainPlayerId: number
): RosterValidationError | null {
  if (players.length !== ROSTER_SIZE) return "WRONG_SIZE";

  const gkCount = players.filter((p) => p.role === PlayerRole.P).length;
  if (gkCount !== REQUIRED_GK) return "WRONG_GK_COUNT";

  const outfieldCount = players.filter((p) => p.role === PlayerRole.A).length;
  if (outfieldCount !== REQUIRED_PLAYERS) return "WRONG_PLAYER_COUNT";

  const teamIds = players.map((p) => p.footballTeamId);
  const uniqueTeamIds = new Set(teamIds);
  if (uniqueTeamIds.size !== ROSTER_SIZE) return "DUPLICATE_TEAM";

  const captainInRoster = players.some((p) => p.playerId === captainPlayerId);
  if (!captainInRoster) return "CAPTAIN_NOT_IN_ROSTER";

  return null;
}
