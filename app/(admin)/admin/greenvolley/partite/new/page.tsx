import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import NewVolleyMatchForm from "./_form";
import { requireAdmin } from "@/lib/session";

export default async function NuovaVolleyPartitaPage() {
  await requireAdmin();
  const [teams, groups, rounds] = await Promise.all([
    db.volleyTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.volleyGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.volleyKnockoutRound.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Nuova partita"
        backHref="/admin/greenvolley/partite"
      />
      <div className="admin-card p-5 max-w-lg">
        <NewVolleyMatchForm teams={teams} groups={groups} rounds={rounds} />
      </div>
    </div>
  );
}
