import "server-only";

import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { MVP_WINDOW_MS } from "@/lib/domain/vote";
import { measureServerTiming } from "@/lib/perf";
import { computeCumulativeRankings, type RankEntry } from "@/lib/scoring";

export async function getFantasyRankingSnapshotOrCompute(): Promise<RankEntry[]> {
  return measureServerTiming("scoring.snapshot.cumulative.get", async () => {
    const snapshot = await readFantasyRankingSnapshot();
    if (snapshot) return snapshot;
    return rebuildFantasyRankingSnapshot();
  });
}

export async function readFantasyRankingSnapshot(): Promise<RankEntry[] | null> {
  return measureServerTiming("scoring.snapshot.cumulative.read", async () => {
    const [rows, teamCount] = await Promise.all([
      db.fantasyRankingSnapshot.findMany({
        orderBy: [{ rank: "asc" }, { fantasyTeam: { name: "asc" } }],
        select: {
          fantasyTeamId: true,
          rank: true,
          totalPoints: true,
          computedAt: true,
          fantasyTeam: {
            select: {
              name: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),
      db.fantasyTeam.count(),
    ]);

    const now = new Date();
    const computedAt = rows[0]?.computedAt ?? now;
    const mvpWindowsClosedAt =
      rows.length === teamCount && rows.length > 0
        ? await getMvpWindowsClosedSince(computedAt, now)
        : [];

    if (isSnapshotStale({ computedAt, snapshotTeamCount: rows.length, teamCount, mvpWindowsClosedAt, now })) {
      return null;
    }

    return rows.map((row) => ({
      rank: row.rank,
      fantasyTeamId: row.fantasyTeamId,
      fantasyTeamName: row.fantasyTeam.name,
      userId: row.fantasyTeam.user.id,
      userName: row.fantasyTeam.user.name,
      totalPoints: Number(row.totalPoints),
    }));
  });
}

export async function rebuildFantasyRankingSnapshot(): Promise<RankEntry[]> {
  return measureServerTiming("scoring.snapshot.cumulative.rebuild", async () => {
    const rankings = await computeCumulativeRankings();
    await replaceFantasyRankingSnapshot(rankings);
    return rankings;
  });
}

export async function invalidateFantasyRankingSnapshot(): Promise<void> {
  await measureServerTiming("scoring.snapshot.cumulative.invalidate", async () => {
    await db.fantasyRankingSnapshot.deleteMany();
  });
}

async function replaceFantasyRankingSnapshot(rankings: RankEntry[]): Promise<void> {
  const computedAt = new Date();
  const writes = [
    db.fantasyRankingSnapshot.deleteMany(),
    ...(rankings.length > 0
      ? [
          db.fantasyRankingSnapshot.createMany({
            data: rankings.map((row) => ({
              fantasyTeamId: row.fantasyTeamId,
              rank: row.rank,
              totalPoints: row.totalPoints,
              computedAt,
            })),
          }),
        ]
      : []),
  ];

  await db.$transaction(writes);
}

export type SnapshotStalenessInput = {
  computedAt: Date;
  snapshotTeamCount: number;
  teamCount: number;
  /** Timestamp di chiusura (concludedAt + MVP_WINDOW_MS) delle finestre MVP. */
  mvpWindowsClosedAt: Date[];
  now: Date;
};

/** Lo snapshot va rigenerato se cambia il numero di squadre o se una finestra MVP si chiude dopo la snapshot. */
export function isSnapshotStale({
  computedAt,
  snapshotTeamCount,
  teamCount,
  mvpWindowsClosedAt,
  now,
}: SnapshotStalenessInput): boolean {
  if (snapshotTeamCount !== teamCount) return true;

  return mvpWindowsClosedAt.some(
    (closedAt) => closedAt.getTime() > computedAt.getTime() && closedAt.getTime() <= now.getTime()
  );
}

async function getMvpWindowsClosedSince(computedAt: Date, now: Date): Promise<Date[]> {
  const minConcludedAt = new Date(computedAt.getTime() - MVP_WINDOW_MS);
  const maxConcludedAt = new Date(now.getTime() - MVP_WINDOW_MS);

  if (maxConcludedAt <= minConcludedAt) return [];

  const matches = await db.match.findMany({
    where: {
      status: MatchStatus.CONCLUDED,
      concludedAt: {
        gt: minConcludedAt,
        lte: maxConcludedAt,
      },
    },
    select: { concludedAt: true },
  });

  return matches
    .filter((match) => match.concludedAt !== null)
    .map((match) => new Date(match.concludedAt!.getTime() + MVP_WINDOW_MS));
}
