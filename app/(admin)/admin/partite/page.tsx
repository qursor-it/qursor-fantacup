import { db } from "@/lib/db";
import PartiteTable from "./_table";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";
export const dynamic = 'force-dynamic'


export default async function PartitePage() {
  await requireAdmin();
  const matches = await db.match.findMany({
    orderBy: { startsAt: "desc" },
    select: {
      id: true, status: true, startsAt: true, homeScore: true, awayScore: true,
      homeSeed: true, awaySeed: true,
      groupId: true, knockoutRoundId: true,
      group: { select: { slug: true } },
      knockoutRound: { select: { name: true } },
      homeTeam: { select: { name: true, shortName: true } },
      awayTeam: { select: { name: true, shortName: true } },
      _count: { select: { players: true } },
    },
  });

  return (
    <div>
      <AdminPageHeader title="Partite" cta={{ href: "/admin/partite/new", label: "Nuova partita" }} />
      <PartiteTable rows={matches} />
    </div>
  );
}
