import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import VolleyPlayerForm from "../_form";
import { requireAdmin } from "@/lib/session";

export default async function NuovoVolleyGiocatorePage() {
  await requireAdmin();
  const teams = await db.volleyTeam.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Nuovo giocatore"
        backHref="/admin/greenvolley/giocatori"
      />
      <div className="admin-card p-5 max-w-lg">
        <VolleyPlayerForm teams={teams} />
      </div>
    </div>
  );
}
