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

    if (rows.length !== teamCount) return null;
    if (rows.length > 0) {
      const staleByMvpWindow = await hasMvpWindowClosedSince(rows[0].computedAt);
      if (staleByMvpWindow) return null;
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

async function hasMvpWindowClosedSince(computedAt: Date): Promise<boolean> {
  const now = new Date();
  const minConcludedAt = new Date(computedAt.getTime() - MVP_WINDOW_MS);
  const maxConcludedAt = new Date(now.getTime() - MVP_WINDOW_MS);

  if (maxConcludedAt <= minConcludedAt) return false;

  const closedAfterSnapshot = await db.match.count({
    where: {
      status: MatchStatus.CONCLUDED,
      concludedAt: {
        gt: minConcludedAt,
        lte: maxConcludedAt,
      },
    },
  });

  return closedAfterSnapshot > 0;
}
