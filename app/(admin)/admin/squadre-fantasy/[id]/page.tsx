import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import RosterForm from "./_roster-form";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

export default async function SquadraFantasyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const fantasyTeamId = parseId(id);
  if (fantasyTeamId === null) notFound();

  const [fantasyTeam, allPlayers] = await Promise.all([
    db.fantasyTeam.findUnique({
      where: { id: fantasyTeamId },
      include: {
        user: { select: { email: true } },
        players: { select: { playerId: true } },
      },
    }),
    db.player.findMany({
      orderBy: [{ footballTeam: { name: "asc" } }, { name: "asc" }],
      include: { footballTeam: { select: { name: true } } },
    }),
  ]);

  if (!fantasyTeam) notFound();

  const currentPlayerIds = fantasyTeam.players.map((p) => p.playerId);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={fantasyTeam.name} backHref="/admin/squadre-fantasy" />

      {/* Owner info */}
      <div className="card px-4 py-3 flex items-center gap-2">
        <i className="pi pi-user text-xs" style={{ color: "var(--text-disabled)" }} />
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{fantasyTeam.user.email}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
        >
          {currentPlayerIds.length}/5
        </span>
      </div>

      <RosterForm
        fantasyTeamId={fantasyTeamId}
        name={fantasyTeam.name}
        currentPlayerIds={currentPlayerIds}
        captainPlayerId={fantasyTeam.captainPlayerId}
        allPlayers={allPlayers}
      />
    </div>
  );
}
