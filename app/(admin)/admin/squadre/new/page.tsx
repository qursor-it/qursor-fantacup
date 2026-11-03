import AdminPageHeader from "@/components/admin-page-header";
import NuovaSquadraForm from "./_form";
import { requireAdmin } from "@/lib/session";

export default async function NuovaSquadraPage() {
  await requireAdmin();
  return (
    <div>
      <AdminPageHeader title="Nuova squadra reale" backHref="/admin/squadre" />
      <div className="admin-card p-5 max-w-lg">
        <NuovaSquadraForm />
      </div>
    </div>
  );
}
