import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export type MatchPlayersSyncResult = {
  /** Giocatori attuali delle due squadre (candidati all'inserimento). */
  playerCount: number;
  /** Righe MatchPlayer rimosse perché non più appartenenti alle due squadre. */
  removedCount: number;
};

/**
 * Allinea i MatchPlayer di una partita ai giocatori attuali delle sue due
 * squadre: aggiunge i mancanti e rimuove solo quelli non più in nessuna delle
 * due squadre e privi di gol, voti o bonus nella partita. Deve girare dentro
 * una transazione del chiamante.
 */
export async function syncMatchPlayers(tx: TxClient, matchId: number): Promise<MatchPlayersSyncResult> {
  const match = await tx.match.findUnique({
    where: { id: matchId },
    select: { homeTeamId: true, awayTeamId: true },
  });
  if (!match) return { playerCount: 0, removedCount: 0 };

  const teamIds = [match.homeTeamId, match.awayTeamId].filter((id): id is number => id !== null);
  if (teamIds.length === 0) return { playerCount: 0, removedCount: 0 };

  const players = await tx.player.findMany({
    where: { footballTeamId: { in: teamIds } },
    select: { id: true },
  });
  const playerIds = players.map((p) => p.id);

  if (playerIds.length > 0) {
    await tx.matchPlayer.createMany({
      data: playerIds.map((playerId) => ({ matchId, playerId })),
      skipDuplicates: true,
    });
  }

  const stale = await tx.matchPlayer.findMany({
    where: { matchId, playerId: { notIn: playerIds } },
    select: { playerId: true },
  });
  const staleIds = stale.map((row) => row.playerId);
  if (staleIds.length === 0) return { playerCount: playerIds.length, removedCount: 0 };

  // Non rimuovere righe con dati collegati: resterebbero orfani nella partita.
  const [goals, votes, bonuses] = await Promise.all([
    tx.matchGoal.findMany({ where: { matchId, scorerId: { in: staleIds } }, select: { scorerId: true } }),
    tx.vote.findMany({ where: { matchId, playerId: { in: staleIds } }, select: { playerId: true } }),
    tx.playerMatchBonus.findMany({ where: { matchId, playerId: { in: staleIds } }, select: { playerId: true } }),
  ]);
  const protectedIds = new Set<number>([
    ...goals.map((g) => g.scorerId),
    ...votes.map((v) => v.playerId),
    ...bonuses.map((b) => b.playerId),
  ]);
  const removableIds = staleIds.filter((id) => !protectedIds.has(id));

  if (removableIds.length > 0) {
    await tx.matchPlayer.deleteMany({ where: { matchId, playerId: { in: removableIds } } });
  }

  return { playerCount: playerIds.length, removedCount: removableIds.length };
}
