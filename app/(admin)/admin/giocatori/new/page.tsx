import { db } from "@/lib/db";
import NuovoGiocatoreForm from "./_form";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";

export default async function NuovoGiocatorePage() {
  await requireAdmin();
  const teams = await db.footballTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div>
      <AdminPageHeader title="Nuovo giocatore" backHref="/admin/giocatori" />
      <div className="admin-card p-5 max-w-lg">
        <NuovoGiocatoreForm teams={teams} />
      </div>
    </div>
  );
}
