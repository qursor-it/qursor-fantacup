import { db } from "@/lib/db";
import GiocatoriTable from "./_table";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";
export const dynamic = 'force-dynamic'


export default async function GiocatoriPage() {
  await requireAdmin();
  const players = await db.player.findMany({
    orderBy: [{ footballTeam: { name: "asc" } }, { name: "asc" }],
    include: { footballTeam: { select: { name: true } } },
  });

  return (
    <div>
      <AdminPageHeader title="Giocatori" cta={{ href: "/admin/giocatori/new", label: "Nuovo giocatore" }} />
      <GiocatoriTable rows={players} />
    </div>
  );
}
