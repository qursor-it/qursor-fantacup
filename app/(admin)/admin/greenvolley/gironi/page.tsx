import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import GroupCard from "./_group-card";
import { requireAdmin } from "@/lib/session";

export default async function VolleyGironiPage() {
  await requireAdmin();
  const [groups, allTeams] = await Promise.all([
    db.volleyGroup.findMany({
      orderBy: { name: "asc" },
      include: {
        teams: {
          include: { team: { select: { id: true, name: true } } },
        },
      },
    }),
    db.volleyTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader accentColor="#0E3D2B"
        title="Gironi GreenVolley"
        cta={{ href: "/admin/greenvolley/gironi/new", label: "Nuovo girone" }}
      />
      {groups.length === 0 ? (
        <div className="admin-card p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Nessun girone. Creane uno.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={{
                id: g.id,
                name: g.name,
                teams: g.teams.map((gt) => ({
                  teamId: gt.teamId,
                  teamName: gt.team.name,
                  qualified: gt.qualified,
                })),
              }}
              availableTeams={allTeams.filter(
                (t) => !g.teams.some((gt) => gt.teamId === t.id)
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
