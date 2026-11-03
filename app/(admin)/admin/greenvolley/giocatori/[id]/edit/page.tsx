import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import AdminPageHeader from "@/components/admin-page-header";
import VolleyPlayerForm from "../../_form";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

export default async function EditVolleyGiocatorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const playerId = parseId(id);
  if (playerId === null) notFound();
  const [player, teams] = await Promise.all([
    db.volleyPlayer.findUnique({ where: { id: playerId } }),
    db.volleyTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!player) notFound();

  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Modifica giocatore"
        backHref="/admin/greenvolley/giocatori"
      />
      <div className="admin-card p-5 max-w-lg">
        <VolleyPlayerForm player={player} teams={teams} />
      </div>
    </div>
  );
}
