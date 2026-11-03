import AdminPageHeader from "@/components/admin-page-header";
import NewGroupForm from "./_form";
import { requireAdmin } from "@/lib/session";

export default async function NewGironeAdminPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-5 max-w-lg">
      <AdminPageHeader title="Nuovo girone" backHref="/admin/gironi" />
      <div className="card p-5">
        <NewGroupForm />
      </div>
    </div>
  );
}
