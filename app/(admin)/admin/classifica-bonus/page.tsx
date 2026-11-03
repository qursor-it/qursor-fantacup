import { db } from "@/lib/db";
import { MatchStatus } from "@prisma/client";
import { getOfficialMvpPlayerId } from "@/lib/domain/mvp";
import AdminPageHeader from "@/components/admin-page-header";
import BonusMalusTables from "./_tables";
import { requireAdmin } from "@/lib/session";
export const dynamic = "force-dynamic";

export default async function ClassificaBonusPage() {
  await requireAdmin();
  const [assignments, bonusTypes, mvpMatches] = await Promise.all([
    db.playerMatchBonus.findMany({
      where: { bonusType: { code: { not: "MVP" } } },
      include: {
        player: {
          select: { id: true, name: true, role: true, footballTeam: { select: { name: true } } },
        },
        bonusType: { select: { id: true, points: true } },
      },
    }),
    db.bonusType.findMany({ orderBy: { code: "asc" } }),
    db.match.findMany({
      where: { status: MatchStatus.CONCLUDED },
      select: {
        concludedAt: true,
        mvpOverridePlayerId: true,
        votes: { select: { playerId: true } },
        players: {
          select: {
            playerId: true,
            player: { select: { id: true, name: true, role: true, footballTeam: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);

  const byPlayerAndType = new Map<
    string,
    { playerId: number; name: string; role: string; teamName: string; bonusTypeId: number; quantity: number }
  >();

  for (const a of assignments) {
    const key = `${a.player.id}-${a.bonusType.id}`;
    const entry = byPlayerAndType.get(key);
    if (entry) {
      entry.quantity += a.quantity;
    } else {
      byPlayerAndType.set(key, {
        playerId: a.player.id,
        name: a.player.name,
        role: a.player.role,
        teamName: a.player.footballTeam.name,
        bonusTypeId: a.bonusType.id,
        quantity: a.quantity,
      });
    }
  }

  const mvpBonusType = bonusTypes.find((bt) => bt.code === "MVP");
  if (mvpBonusType) {
    for (const match of mvpMatches) {
      const mvpId = getOfficialMvpPlayerId({
        concludedAt: match.concludedAt,
        votes: match.votes,
        mvpOverridePlayerId: match.mvpOverridePlayerId,
        eligiblePlayerIds: match.players.map((p) => p.playerId),
      });
      if (mvpId === null) continue;

      const mp = match.players.find((p) => p.playerId === mvpId);
      if (!mp) continue;

      const key = `${mvpId}-${mvpBonusType.id}`;
      const entry = byPlayerAndType.get(key);
      if (entry) {
        entry.quantity += 1;
      } else {
        byPlayerAndType.set(key, {
          playerId: mvpId,
          name: mp.player.name,
          role: mp.player.role,
          teamName: mp.player.footballTeam.name,
          bonusTypeId: mvpBonusType.id,
          quantity: 1,
        });
      }
    }
  }

  const rows = Array.from(byPlayerAndType.values());
  const types = bonusTypes.map((bt) => ({
    id: bt.id,
    code: bt.code,
    name: bt.name,
    points: Number(bt.points),
  }));

  return (
    <div>
      <AdminPageHeader title="Classifica bonus/malus" />
      <BonusMalusTables rows={rows} bonusTypes={types} />
    </div>
  );
}
