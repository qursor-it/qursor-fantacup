import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import VolleyTeamsTable from "./_table";
import { requireAdmin } from "@/lib/session";

export default async function VolleySquadrePage() {
  await requireAdmin();
  const teams = await db.volleyTeam.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { players: true } } },
  });

  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Squadre GreenVolley"
        cta={{ href: "/admin/greenvolley/squadre/new", label: "Nuova squadra" }}
      />
      <VolleyTeamsTable
        teams={teams.map((t) => ({
          id: t.id,
          name: t.name,
          playerCount: t._count.players,
        }))}
      />
    </div>
  );
}
