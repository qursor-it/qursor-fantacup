import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import AuditTable from "./_table";
export const dynamic = 'force-dynamic'


export default async function AuditPage() {
  const logs = await db.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { adminUser: { select: { email: true } } },
  });

  const rows = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt.toLocaleString("it-IT"),
    adminEmail: log.adminUser?.email ?? "(account eliminato)",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId ?? null,
  }));

  return (
    <div>
      <AdminPageHeader title="Audit log" />
      <AuditTable rows={rows} />
    </div>
  );
}
