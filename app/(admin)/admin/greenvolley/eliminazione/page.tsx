import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import KnockoutRoundsClient from "./_rounds-client";
import { requireAdmin } from "@/lib/session";

export default async function VolleyEliminazionePage() {
  await requireAdmin();
  const rounds = await db.volleyKnockoutRound.findMany({
    orderBy: { order: "asc" },
    include: {
      _count: { select: { matches: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader accentColor="#0E3D2B" title="Eliminazione GreenVolley" />
      <KnockoutRoundsClient
        rounds={rounds.map((r) => ({
          id: r.id,
          name: r.name,
          order: r.order,
          matchCount: r._count.matches,
        }))}
      />
    </div>
  );
}
