import { db } from "@/lib/db";
import UtentiTable from "./_table";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";
export const dynamic = 'force-dynamic'


export default async function UtentiPage() {
  await requireAdmin();
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    include: { fantasyTeam: { select: { id: true, name: true } } },
    omit: { passwordHash: true, provisionedPasswordHash: true },
  });

  const admins = users.filter((u) => u.role === "ADMIN");
  const regulars = users.filter((u) => u.role === "USER");

  return (
    <div>
      <AdminPageHeader title="Utenti" />
      <UtentiTable admins={admins} users={regulars} />
    </div>
  );
}
