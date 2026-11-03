import Link from "next/link";
import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import { requireAdmin } from "@/lib/session";

export default async function GironiAdminPage() {
  await requireAdmin();
  const groups = await db.group.findMany({
    orderBy: { order: "asc" },
    include: {
      teams: {
        include: { footballTeam: { select: { name: true, shortName: true } } },
      },
      _count: { select: { matches: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <AdminPageHeader title="Gironi" backHref="/admin" />
        <Link
          href="/admin/gironi/new"
          className="text-sm font-semibold flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          <i className="pi pi-plus text-[11px]" /> Nuovo girone
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="card p-10 text-center over-label">Nessun girone creato.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/admin/gironi/${g.id}`}
              className="card p-4 flex flex-col gap-3 transition-colors hover:bg-[var(--surface-1)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="font-display font-black text-xl uppercase"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Girone {g.slug}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{g.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                  >
                    {g.teams.length} squadre
                  </span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                  >
                    {g._count.matches} partite
                  </span>
                </div>
              </div>

              {g.teams.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {g.teams.map((gt) => (
                    <span
                      key={gt.footballTeamId}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={
                        gt.qualified
                          ? { background: "#ECFDF5", color: "#065F46" }
                          : { background: "var(--surface-2)", color: "var(--text-secondary)" }
                      }
                    >
                      {gt.footballTeam.shortName ?? gt.footballTeam.name}
                      {gt.qualified && " ✓"}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
