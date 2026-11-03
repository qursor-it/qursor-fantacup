import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { computeStandings } from "@/lib/standings";
import EditFootballTeamForm from "./_form";
import AdminPageHeader from "@/components/admin-page-header";
import RoleBadge from "@/components/role-badge";
import ConfirmDeleteForm from "@/components/confirm-delete-form";
import { removePlayerFromFootballTeam } from "@/app/actions/admin/players";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

export default async function EditSquadraPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const teamId = parseId(id);
  if (teamId === null) notFound();

  const [team, standings, groupTeam] = await Promise.all([
    db.footballTeam.findUnique({
      where: { id: teamId },
      include: {
        players: { orderBy: [{ role: "asc" }, { name: "asc" }] },
        homeMatches: {
          where: { status: { not: "DRAFT" } },
          select: { id: true, status: true, homeScore: true, awayScore: true, startsAt: true, awayTeam: { select: { name: true, shortName: true } } },
          orderBy: { startsAt: "desc" },
        },
        awayMatches: {
          where: { status: { not: "DRAFT" } },
          select: { id: true, status: true, homeScore: true, awayScore: true, startsAt: true, homeTeam: { select: { name: true, shortName: true } } },
          orderBy: { startsAt: "desc" },
        },
      },
    }),
    computeStandings(),
    db.groupTeam.findFirst({
      where: { footballTeamId: teamId },
      include: { group: { select: { id: true, name: true, slug: true } } },
    }),
  ]);

  if (!team) notFound();

  const standing = standings.find((s) => s.teamId === teamId);

  // Merge matches sorted by date
  const allMatches = [
    ...team.homeMatches.map((m) => ({ ...m, isHome: true as const, opponent: m.awayTeam })),
    ...team.awayMatches.map((m) => ({ ...m, isHome: false as const, opponent: m.homeTeam })),
  ].sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  const concluded = allMatches.filter((m) => m.homeScore !== null && m.awayScore !== null);
  const wins  = concluded.filter((m) => m.isHome ? (m.homeScore! > m.awayScore!) : (m.awayScore! > m.homeScore!)).length;
  const draws = concluded.filter((m) => m.homeScore === m.awayScore).length;
  const losses = concluded.length - wins - draws;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Squadra" backHref="/admin/squadre" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left col: form + standing ───────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Edit form */}
          <div className="card p-5">
            <div className="over-label mb-4">Modifica</div>
            <EditFootballTeamForm team={team} />
          </div>

          {/* Girone */}
          {groupTeam && (
            <div className="card p-4">
              <div className="over-label mb-2">Girone</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-display font-black text-base uppercase" style={{ color: "var(--text-primary)" }}>
                    Girone {groupTeam.group.slug}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{groupTeam.group.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  {groupTeam.qualified && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#ECFDF5", color: "#065F46" }}>
                      ✓ Qualificata
                    </span>
                  )}
                  <Link
                    href={`/admin/gironi/${groupTeam.group.id}`}
                    className="text-[11px] font-semibold flex items-center gap-1"
                    style={{ color: "var(--primary)" }}
                  >
                    Gestisci <i className="pi pi-arrow-right text-[9px]" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Classifica */}
          {standing && (
            <div className="card p-4">
              <div className="over-label mb-3">Posizione in classifica</div>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-xl flex-shrink-0"
                  style={
                    standing.rank === 1
                      ? { background: "linear-gradient(135deg,#E8A000,#C87800)", color: "#fff", boxShadow: "0 3px 10px rgba(232,160,0,0.4)" }
                      : { background: "var(--surface-2)", color: "var(--text-secondary)" }
                  }
                >
                  {standing.rank}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 flex-1">
                  {[
                    ["G", standing.played],
                    ["V", standing.won],
                    ["N", standing.drawn],
                    ["S", standing.lost],
                    ["DR", standing.goalDiff > 0 ? `+${standing.goalDiff}` : standing.goalDiff],
                    ["PT", standing.points],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-black uppercase" style={{ color: "var(--text-muted)" }}>{k}</span>
                      <span className="text-sm font-display font-black" style={{ color: "var(--text-primary)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right cols: players + matches ───────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Players */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">Rosa ({team.players.length} giocatori)</div>
            </div>
            {team.players.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessun giocatore in rosa.</p>
            ) : (
              team.players.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-1)] transition-colors cursor-pointer"
                  style={{ borderBottom: idx < team.players.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                >
                  <RoleBadge role={p.role} />
                  <span className="text-sm font-semibold flex-1" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                  <div className="flex items-center gap-2">
                    <ConfirmDeleteForm
                      action={removePlayerFromFootballTeam}
                      hiddenInputs={{ playerId: p.id, footballTeamId: team.id }}
                      confirmMessage={`Rimuovere ${p.name} dalla squadra?`}
                      buttonLabel="Rimuovi"
                      buttonClassName="!px-2"
                    />
                    <Link
                      href={`/admin/giocatori/${p.id}/edit`}
                      className="text-[11px] font-semibold flex items-center gap-1"
                      style={{ color: "var(--primary)" }}
                    >
                      Modifica
                      <i className="pi pi-arrow-right text-[9px]" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent matches */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">Partite ({allMatches.length})</div>
              {concluded.length > 0 && (
                <div className="flex items-center gap-3 mt-1">
                  {[["V", wins, "#065F46", "#ECFDF5"], ["N", draws, "var(--text-muted)", "var(--surface-2)"], ["S", losses, "#991B1B", "#FEF2F2"]].map(([l, v, c, bg]) => (
                    <span key={l} className="text-[11px] font-black px-2 py-0.5 rounded-full" style={{ background: bg as string, color: c as string }}>
                      {l} {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {allMatches.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessuna partita.</p>
            ) : (
              allMatches.map((m, idx) => {
                const hs = m.isHome ? m.homeScore : m.awayScore;
                const as_ = m.isHome ? m.awayScore : m.homeScore;
                const won  = hs !== null && as_ !== null && hs > as_;
                const lost = hs !== null && as_ !== null && hs < as_;
                return (
                  <Link
                    key={m.id}
                    href={`/admin/partite/${m.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-1)] transition-colors"
                    style={{ borderBottom: idx < allMatches.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                  >
                    <span
                      className="text-[10px] font-black w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: hs === null ? "var(--text-disabled)" : won ? "#10B981" : lost ? "#EF4444" : "#94A3B8" }}
                      title={won ? "Vittoria" : lost ? "Sconfitta" : "Pareggio"}
                    />
                    <span className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                      {m.isHome ? "vs" : "@"} {m.opponent?.shortName ?? m.opponent?.name ?? "TBD"}
                    </span>
                    <span className="text-sm font-display font-black flex-shrink-0" style={{ color: hs !== null ? "var(--text-primary)" : "var(--text-disabled)" }}>
                      {hs !== null && as_ !== null ? `${hs} — ${as_}` : "—"}
                    </span>
                    <span className="text-[11px] flex-shrink-0 hidden sm:block" style={{ color: "var(--text-muted)" }}>
                      {new Date(m.startsAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" })}
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
