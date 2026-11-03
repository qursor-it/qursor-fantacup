import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { computeGroupStandings } from "@/lib/standings";
import AdminPageHeader from "@/components/admin-page-header";
import { EditGroupForm, DeleteGroupForm, AddTeamForm, RemoveTeamForm, ToggleQualifiedForm } from "./_forms";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

export default async function GironeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const groupId = parseId(id);
  if (groupId === null) notFound();

  const [group, allTeams, standings, matches] = await Promise.all([
    db.group.findUnique({
      where: { id: groupId },
      include: {
        teams: {
          include: { footballTeam: { select: { id: true, name: true, shortName: true } } },
          orderBy: { footballTeam: { name: "asc" } },
        },
      },
    }),
    db.footballTeam.findMany({ orderBy: { name: "asc" } }),
    computeGroupStandings(groupId),
    db.match.findMany({
      where: { groupId, status: { not: "DRAFT" } },
      orderBy: { startsAt: "asc" },
      include: {
        homeTeam: { select: { shortName: true, name: true } },
        awayTeam: { select: { shortName: true, name: true } },
      },
    }),
  ]);

  if (!group) notFound();

  const assignedTeamIds = new Set(group.teams.map((gt) => gt.footballTeamId));
  const availableTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title={`Girone ${group.slug}`} backHref="/admin/gironi" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left: edit + delete ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="over-label mb-4">Modifica</div>
            <EditGroupForm group={group} />
          </div>
          <div className="card p-5">
            <div className="over-label mb-3">Zona pericolo</div>
            <DeleteGroupForm groupId={groupId} />
          </div>
        </div>

        {/* ── Right: teams + standings + matches ──────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Teams */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">Squadre ({group.teams.length})</div>
            </div>

            {group.teams.length === 0 ? (
              <p className="px-4 py-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>
                Nessuna squadra nel girone.
              </p>
            ) : (
              group.teams.map((gt, idx) => (
                <div
                  key={gt.footballTeamId}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: idx < group.teams.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                >
                  <span className="text-sm font-semibold flex-1" style={{ color: "var(--text-primary)" }}>
                    {gt.footballTeam.name}
                  </span>
                  <ToggleQualifiedForm
                    groupId={groupId}
                    footballTeamId={gt.footballTeamId}
                    qualified={gt.qualified}
                  />
                  <RemoveTeamForm groupId={groupId} footballTeamId={gt.footballTeamId} />
                </div>
              ))
            )}

            {availableTeams.length > 0 && (
              <div className="px-4 py-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <AddTeamForm groupId={groupId} availableTeams={availableTeams} />
              </div>
            )}
          </div>

          {/* Standings */}
          {standings.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <div className="over-label">Classifica</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
                      {["#", "Squadra", "G", "V", "N", "S", "DR", "PT"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-[10px] font-black uppercase text-right first:text-left"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s) => (
                      <tr
                        key={s.teamId}
                        style={{ borderBottom: "1px solid var(--border-soft)" }}
                      >
                        <td className="px-3 py-2.5 text-xs font-black" style={{ color: "var(--text-muted)" }}>{s.rank}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.teamName}</span>
                          {group.teams.find((gt) => gt.footballTeamId === s.teamId)?.qualified && (
                            <span className="ml-1.5 text-[10px] font-bold" style={{ color: "#065F46" }}>✓</span>
                          )}
                        </td>
                        {[s.played, s.won, s.drawn, s.lost, s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff, s.points].map((v, i) => (
                          <td key={i} className="px-3 py-2.5 text-right tabular-nums" style={{ color: i === 5 ? "var(--primary)" : "var(--text-secondary)", fontWeight: i === 5 ? 700 : 500 }}>
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matches */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">Partite ({matches.length})</div>
              <Link
                href={`/admin/partite/new?groupId=${groupId}`}
                className="text-[11px] font-semibold flex items-center gap-1"
                style={{ color: "var(--primary)" }}
              >
                <i className="pi pi-plus text-[9px]" /> Nuova partita
              </Link>
            </div>
            {matches.length === 0 ? (
              <p className="px-4 py-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessuna partita.</p>
            ) : (
              matches.map((m, idx) => {
                const home = m.homeTeam?.shortName ?? m.homeTeam?.name ?? m.homeSeed ?? "TBD";
                const away = m.awayTeam?.shortName ?? m.awayTeam?.name ?? m.awaySeed ?? "TBD";
                const scored = m.homeScore !== null && m.awayScore !== null;
                return (
                  <Link
                    key={m.id}
                    href={`/admin/partite/${m.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-1)] transition-colors"
                    style={{ borderBottom: idx < matches.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                  >
                    <span className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                      {home} — {away}
                    </span>
                    {scored && (
                      <span className="text-sm font-display font-black flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                        {m.homeScore} — {m.awayScore}
                      </span>
                    )}
                    <span className="text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {m.startsAt.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  </Link>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
