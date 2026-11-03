import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import VolleyMatchesTable from "./_table";
import { requireAdmin } from "@/lib/session";

export default async function VolleyPartitePage() {
  await requireAdmin();
  const matches = await db.volleyMatch.findMany({
    orderBy: { date: "desc" },
    include: {
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
      sets: true,
      group: { select: { name: true } },
      knockoutRound: { select: { name: true } },
    },
  });

  return (
    <div>
      <AdminPageHeader accentColor="#0E3D2B"
        title="Partite GreenVolley"
        cta={{ href: "/admin/greenvolley/partite/new", label: "Nuova partita" }}
      />
      <VolleyMatchesTable
        matches={matches.map((m) => {
          const homeSets = m.sets.filter((s) => s.homePoints > s.awayPoints).length;
          const awaySets = m.sets.filter((s) => s.awayPoints > s.homePoints).length;
          return {
            id: m.id,
            homeTeamName: m.homeTeam.name,
            awayTeamName: m.awayTeam.name,
            status: m.status,
            date: m.date,
            result: m.sets.length > 0 ? `${homeSets}-${awaySets}` : "—",
            groupId: m.groupId,
            knockoutRoundId: m.knockoutRoundId,
            groupName: m.group?.name ?? null,
            knockoutRoundName: m.knockoutRound?.name ?? null,
            setCount: m.sets.length,
          };
        })}
      />
    </div>
  );
}
