import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import AdminPageHeader from "@/components/admin-page-header";
import VolleyTeamForm from "../../_form";
import TeamPlayersSection from "../_team-players";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

export default async function EditVolleySquadraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const teamId = parseId(id);
  if (teamId === null) notFound();
  const team = await db.volleyTeam.findUnique({
    where: { id: teamId },
    include: { players: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });
  if (!team) notFound();

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader accentColor="#0E3D2B"
        title="Modifica squadra"
        backHref="/admin/greenvolley/squadre"
      />
      <div className="admin-card p-5 max-w-lg">
        <VolleyTeamForm team={team} />
      </div>

      <div>
        <div
          className="text-[10px] font-black uppercase tracking-widest mb-3"
          style={{ color: "#0E3D2B" }}
        >
          Giocatori ({team.players.length})
        </div>
        <div className="max-w-lg">
          <TeamPlayersSection teamId={team.id} players={team.players} />
        </div>
      </div>
    </div>
  );
}
