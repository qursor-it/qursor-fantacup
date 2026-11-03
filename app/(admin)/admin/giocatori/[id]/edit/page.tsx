import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import EditGiocatoreForm from "./_form";
import AdminPageHeader from "@/components/admin-page-header";

export default async function EditGiocatorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = Number(id);

  const [player, teams, goals, bonuses, appearances, fantasySlots] = await Promise.all([
    db.player.findUnique({
      where: { id: playerId },
      include: { footballTeam: { select: { id: true, name: true, shortName: true } } },
    }),
    db.footballTeam.findMany({ orderBy: { name: "asc" } }),
    db.matchGoal.findMany({
      where: { scorerId: playerId },
      include: {
        match: {
          select: {
            id: true,
            startsAt: true,
            homeScore: true,
            awayScore: true,
            homeSeed: true,
            awaySeed: true,
            homeTeam: { select: { shortName: true, name: true } },
            awayTeam: { select: { shortName: true, name: true } },
          },
        },
      },
      orderBy: { match: { startsAt: "desc" } },
    }),
    db.playerMatchBonus.findMany({
      where: { playerId },
      include: { bonusType: true },
      orderBy: { id: "asc" },
    }),
    db.matchPlayer.findMany({
      where: { playerId },
      include: {
        match: {
          select: {
            id: true,
            startsAt: true,
            status: true,
            homeScore: true,
            awayScore: true,
            homeTeamId: true,
            awayTeamId: true,
            homeSeed: true,
            awaySeed: true,
            homeTeam: { select: { shortName: true, name: true } },
            awayTeam: { select: { shortName: true, name: true } },
          },
        },
      },
      orderBy: { match: { startsAt: "desc" } },
    }),
    db.fantasyTeamPlayer.findMany({
      where: { playerId },
      include: { fantasyTeam: { include: { user: { select: { name: true, email: true } } } } },
    }),
  ]);

  if (!player) notFound();

  // Compute total fantasy points
  const totalPoints = bonuses.reduce((sum, b) => sum + Number(b.points), 0);

  // Group bonuses by match for the breakdown
  const bonusByMatch = new Map<number, { matchId: number; points: number; bonuses: typeof bonuses }>();
  for (const b of bonuses) {
    const entry = bonusByMatch.get(b.matchId) ?? { matchId: b.matchId, points: 0, bonuses: [] };
    entry.points += Number(b.points);
    entry.bonuses.push(b);
    bonusByMatch.set(b.matchId, entry);
  }

  const regularGoals = goals.filter((g) => !g.isOwnGoal).length;
  const ownGoals = goals.filter((g) => g.isOwnGoal).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Giocatore" backHref="/admin/giocatori" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Left col: form + fantasy teams ──────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Edit form */}
          <div className="card p-5">
            <div className="over-label mb-4">Modifica</div>
            <EditGiocatoreForm player={player} teams={teams} />
          </div>

          {/* Fantasy teams */}
          {fantasySlots.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <div className="over-label">Squadre fanta ({fantasySlots.length})</div>
              </div>
              {fantasySlots.map((slot, idx) => (
                <div
                  key={slot.fantasyTeamId}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: idx < fantasySlots.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: "var(--primary)" }}
                  >
                    {(slot.fantasyTeam.user.name ?? slot.fantasyTeam.user.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {slot.fantasyTeam.name}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {slot.fantasyTeam.user.name ?? slot.fantasyTeam.user.email}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right cols: stats + goals + matches ──────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Stats strip */}
          <div className="card p-4">
            <div className="over-label mb-3">Statistiche</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Presenze", value: appearances.length },
                { label: "Goal", value: regularGoals },
                { label: "Autogoal", value: ownGoals },
                { label: "Punti fanta", value: totalPoints % 1 === 0 ? totalPoints : totalPoints.toFixed(1) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center rounded-xl py-3 gap-0.5"
                  style={{ background: "var(--surface-1)" }}
                >
                  <span className="font-display font-black text-2xl leading-none" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Goals */}
          {goals.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <div className="over-label">
                  Goal ({regularGoals}
                  {ownGoals > 0 && <span style={{ color: "var(--text-muted)" }}> + {ownGoals} AG</span>})
                </div>
              </div>
              {goals.map((g, idx) => {
                const m = g.match;
                const home = m.homeTeam?.shortName ?? m.homeTeam?.name ?? m.homeSeed ?? "TBD";
                const away = m.awayTeam?.shortName ?? m.awayTeam?.name ?? m.awaySeed ?? "TBD";
                return (
                  <Link
                    key={g.id}
                    href={`/admin/partite/${m.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-1)] transition-colors"
                    style={{ borderBottom: idx < goals.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                  >
                    {g.isOwnGoal && (
                      <span className="text-[9px] font-black px-1 py-0.5 rounded flex-shrink-0" style={{ background: "#FEF2F2", color: "#991B1B" }}>
                        AG
                      </span>
                    )}
                    <span className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                      {home} — {away}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {new Date(m.startsAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Match appearances */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">Partite ({appearances.length})</div>
            </div>
            {appearances.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessuna presenza.</p>
            ) : (
              appearances.map(({ match: m }, idx) => {
                const isHome = m.homeTeamId === player.footballTeamId;
                const hs = isHome ? m.homeScore : m.awayScore;
                const as_ = isHome ? m.awayScore : m.homeScore;
                const won  = hs !== null && as_ !== null && hs > as_;
                const lost = hs !== null && as_ !== null && hs < as_;
                const opponent = isHome
                  ? (m.awayTeam?.shortName ?? m.awayTeam?.name ?? m.awaySeed ?? "TBD")
                  : (m.homeTeam?.shortName ?? m.homeTeam?.name ?? m.homeSeed ?? "TBD");
                const matchPoints = bonusByMatch.get(m.id)?.points ?? 0;
                return (
                  <Link
                    key={m.id}
                    href={`/admin/partite/${m.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-1)] transition-colors"
                    style={{ borderBottom: idx < appearances.length - 1 ? "1px solid var(--border-soft)" : undefined }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{ background: hs === null ? "var(--text-disabled)" : won ? "#10B981" : lost ? "#EF4444" : "#94A3B8" }}
                      title={won ? "Vittoria" : lost ? "Sconfitta" : hs !== null ? "Pareggio" : "Non conclusa"}
                    />
                    <span className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                      {isHome ? "vs" : "@"} {opponent}
                    </span>
                    {hs !== null && as_ !== null && (
                      <span className="text-sm font-display font-black flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                        {hs} — {as_}
                      </span>
                    )}
                    {matchPoints !== 0 && (
                      <span
                        className="text-[11px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: "#ECFDF5", color: "#065F46" }}
                      >
                        +{matchPoints % 1 === 0 ? matchPoints : matchPoints.toFixed(1)}pt
                      </span>
                    )}
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
