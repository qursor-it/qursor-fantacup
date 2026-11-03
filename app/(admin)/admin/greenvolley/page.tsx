import { db } from "@/lib/db";
import Link from "next/link";
import { computeVolleyStandings } from "@/lib/volley/standings";
import { requireAdmin } from "@/lib/session";

const GV = "#0E3D2B";

export default async function GreenVolleyDashboard() {
  await requireAdmin();
  const [teamCount, playerCount, matchCount, concludedCount, nextMatch, recentMatches, groups] = await Promise.all([
    db.volleyTeam.count(),
    db.volleyPlayer.count(),
    db.volleyMatch.count(),
    db.volleyMatch.count({ where: { status: "CONCLUDED" } }),
    db.volleyMatch.findFirst({
      where: { status: "SCHEDULED" },
      orderBy: { date: "asc" },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
      },
    }),
    db.volleyMatch.findMany({
      where: { status: "CONCLUDED" },
      orderBy: { date: "desc" },
      take: 4,
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        sets: true,
      },
    }),
    db.volleyGroup.findMany({
      orderBy: { name: "asc" },
      take: 1,
      include: {
        teams: { include: { team: { select: { id: true, name: true } } } },
        matches: { where: { status: "CONCLUDED" }, include: { sets: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Squadre",  value: teamCount,     href: "/admin/greenvolley/squadre",  icon: "pi-shield"       },
    { label: "Giocatori",value: playerCount,   href: "/admin/greenvolley/giocatori",icon: "pi-users"        },
    { label: "Partite",  value: matchCount,    href: "/admin/greenvolley/partite",  icon: "pi-calendar"     },
    { label: "Concluse", value: concludedCount,href: "/admin/greenvolley/partite",  icon: "pi-check-circle" },
  ];

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long",
  });

  const firstGroup = groups[0] ?? null;
  const standings = firstGroup
    ? computeVolleyStandings(
        firstGroup.teams.map((gt) => gt.team),
        firstGroup.matches.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          status: m.status,
          homeDisciplinaryPoints: m.homeDisciplinaryPoints,
          awayDisciplinaryPoints: m.awayDisciplinaryPoints,
          sets: m.sets,
        }))
      ).slice(0, 4)
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: GV }}>
            GreenVolley
          </div>
          <h1 className="font-display font-black text-3xl uppercase leading-none" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
        </div>
        <span className="text-sm capitalize hidden sm:block pb-1" style={{ color: "var(--text-muted)" }}>
          {today}
        </span>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link
            key={s.href + s.label}
            href={s.href}
            className="admin-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2" style={{ color: GV }}>
              <i className={`pi ${s.icon}`} />
              <span className="text-xs font-black uppercase tracking-wide">{s.label}</span>
            </div>
            <div className="text-3xl font-black" style={{ color: "var(--text-primary)" }}>
              {s.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Next match hero */}
      {nextMatch ? (
        <Link
          href={`/admin/greenvolley/partite`}
          className="block rounded-[20px] overflow-hidden transition-transform hover:-translate-y-px"
          style={{ background: "linear-gradient(145deg, #0d1f0d 0%, #1a3a1a 100%)", boxShadow: "0 6px 32px rgba(61,217,7,0.18)" }}
        >
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GV }} />
              <span className="text-[11px] font-black uppercase tracking-widest text-white/60">
                Prossima partita
              </span>
            </div>
            {nextMatch.date && (
              <span className="text-[11px] font-semibold text-white/50 capitalize">
                {nextMatch.date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          <div className="px-5 py-5 flex items-center gap-3">
            <div className="flex-1 text-center">
              <div className="font-display font-black text-2xl sm:text-3xl uppercase leading-none tracking-tight text-white truncate">
                {nextMatch.homeTeam.name}
              </div>
            </div>
            <div className="flex-shrink-0 font-display font-black text-2xl text-white/30 px-2">VS</div>
            <div className="flex-1 text-center">
              <div className="font-display font-black text-2xl sm:text-3xl uppercase leading-none tracking-tight text-white truncate">
                {nextMatch.awayTeam.name}
              </div>
            </div>
          </div>
          <div className="px-5 py-2.5 flex items-center justify-end gap-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="text-[11px] font-semibold text-white/40">Gestisci</span>
            <i className="pi pi-arrow-right text-[10px] text-white/40" />
          </div>
        </Link>
      ) : (
        <div
          className="rounded-[20px] px-5 py-6 flex items-center gap-4"
          style={{ background: "var(--surface-1)", border: "1px dashed var(--border-medium)" }}
        >
          <i className="pi pi-calendar text-2xl" style={{ color: "var(--text-disabled)" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Nessuna partita programmata</div>
            <Link href="/admin/greenvolley/partite" className="text-xs font-semibold" style={{ color: GV }}>
              Crea una partita →
            </Link>
          </div>
        </div>
      )}

      {/* Standings + Recent matches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Standings */}
        {firstGroup && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">{firstGroup.name}</div>
              <Link href="/admin/greenvolley/gironi" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: GV }}>
                Gironi <i className="pi pi-arrow-right text-[9px]" />
              </Link>
            </div>
            {standings.length === 0 ? (
              <p className="px-4 py-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessuna partita conclusa.</p>
            ) : (
              standings.map((s, i) => (
                <div
                  key={s.teamId}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < standings.length - 1 ? "1px solid var(--border-soft)" : "none" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                    style={
                      i === 0
                        ? { background: "linear-gradient(135deg,#E8A000,#C87800)", color: "#fff" }
                        : i === 1
                        ? { background: "var(--surface-2)", color: "var(--text-secondary)" }
                        : { background: "var(--surface-1)", color: "var(--text-muted)" }
                    }
                  >
                    {i + 1}
                  </div>
                  <span className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {s.teamName}
                  </span>
                  <div className="text-right flex-shrink-0">
                    <span className="font-display font-black text-base" style={{ color: GV }}>{s.setsWon}</span>
                    <span className="text-[10px] ml-0.5" style={{ color: "var(--text-muted)" }}>pt</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Recent matches */}
        {recentMatches.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <div className="over-label">Ultime partite</div>
              <Link href="/admin/greenvolley/partite" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: GV }}>
                Tutte <i className="pi pi-arrow-right text-[9px]" />
              </Link>
            </div>
            {recentMatches.map((m, i) => {
              const homeSets = m.sets.filter((s) => s.homePoints > s.awayPoints).length;
              const awaySets = m.sets.filter((s) => s.awayPoints > s.homePoints).length;
              return (
                <Link
                  key={m.id}
                  href={`/admin/greenvolley/partite/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-1)] transition-colors"
                  style={{ borderBottom: i < recentMatches.length - 1 ? "1px solid var(--border-soft)" : "none" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {m.homeTeam.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {m.awayTeam.name}
                    </div>
                  </div>
                  <div className="font-black text-base flex-shrink-0" style={{ color: GV }}>
                    {homeSets}–{awaySets}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
