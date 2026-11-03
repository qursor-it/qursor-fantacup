import { db } from "@/lib/db";
import SquadreFantasyTable from "./_table";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";
export const dynamic = 'force-dynamic'


export default async function SquadreFantasyPage() {
  await requireAdmin();
  const teams = await db.fantasyTeam.findMany({
    orderBy: { name: "asc" },
    include: {
      user: { select: { email: true } },
      _count: { select: { players: true } },
    },
  });

  return (
    <div>
      <AdminPageHeader title="Squadre Fanta" />
      <SquadreFantasyTable rows={teams} />
    </div>
  );
}
