import { db } from "@/lib/db";
import NuovaPartitaForm from "./_form";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";

export default async function NuovaPartitaPage({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [teams, groups] = await Promise.all([
    db.footballTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.group.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);
  return (
    <div>
      <AdminPageHeader title="Nuova partita" backHref="/admin/partite" />
      <div className="admin-card p-5">
        <NuovaPartitaForm
          teams={teams}
          groups={groups}
          defaultGroupId={sp.groupId ? Number(sp.groupId) : null}
        />
      </div>
    </div>
  );
}
