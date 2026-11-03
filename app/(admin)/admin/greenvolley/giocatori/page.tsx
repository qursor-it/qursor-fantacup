import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import VolleyPlayersTable from "./_table";
import { requireAdmin } from "@/lib/session";

export default async function VolleyGiocatoriPage() {
  await requireAdmin();
  const players = await db.volleyPlayer.findMany({
    orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    include: { team: { select: { id: true, name: true } } },
  });

  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Giocatori GreenVolley"
        cta={{ href: "/admin/greenvolley/giocatori/new", label: "Nuovo giocatore" }}
      />
      <VolleyPlayersTable
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          teamId: p.teamId,
          teamName: p.team.name,
        }))}
      />
    </div>
  );
}
