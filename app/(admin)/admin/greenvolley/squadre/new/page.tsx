import AdminPageHeader from "@/components/admin-page-header";
import VolleyTeamForm from "../_form";
import { requireAdmin } from "@/lib/session";

export default async function NuovaVolleySquadraPage() {
  await requireAdmin();
  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Nuova squadra"
        backHref="/admin/greenvolley/squadre"
      />
      <div className="admin-card p-5 max-w-lg">
        <VolleyTeamForm />
      </div>
    </div>
  );
}
