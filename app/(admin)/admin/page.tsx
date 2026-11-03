import Link from "next/link";
import { db } from "@/lib/db";
import { getMatchClockNow, LIVE_MATCH_WINDOW_MS } from "@/lib/domain/match";
import { computeStandings } from "@/lib/standings";
import { getFantasyRankingSnapshotOrCompute } from "@/lib/fantasy-ranking-snapshot";
import { requireAdmin } from "@/lib/session";

type AdminDashboardMatch = {
  id: number;
  startsAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  homeSeed: string | null;
  awaySeed: string | null;
  homeTeam: { name: string; shortName: string | null } | null;
  awayTeam: { name: string; shortName: string | null } | null;
};

export default async function AdminDashboardPage() {
  await requireAdmin();
  const matchClockNow = getMatchClockNow();
  const [
    teamCount, playerCount, matchCount, userCount, fantasyTeamCount,
    liveMatch,
    nextMatch,
    recentMatches,
    concludedNoPlayers,
    usersNoTeam,
    standings,
    rankings,
    groups,
  ] = await Promise.all([
    db.footballTeam.count(),
    db.player.count(),
    db.match.count(),
    db.user.count(),
    db.fantasyTeam.count(),
    db.match.findFirst({
      where: {
        status: "SCHEDULED",
        startsAt: {
          lte: matchClockNow,
          gte: new Date(matchClockNow.getTime() - LIVE_MATCH_WINDOW_MS),
        },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      include: {
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
    }),
    db.match.findFirst({
      where: { status: "SCHEDULED", startsAt: { gt: matchClockNow } },
      orderBy: { startsAt: "asc" },
      include: {
        homeTeam: { select: { name: true, shortName: true } },
        awayTeam: { select: { name: true, shortName: true } },
      },
    }),
    db.match.findMany({
      where: { status: "CONCLUDED", homeScore: { not: null }, awayScore: { not: null } },
      orderBy: { startsAt: "desc" },
      take: 4,
      include: {
        homeTeam: { select: { shortName: true, name: true } },
        awayTeam: { select: { shortName: true, name: true } },
      },
    }),
    db.match.findMany({
      where: { status: "CONCLUDED", players: { none: {} } },
      select: { id: true, homeSeed: true, awaySeed: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
      orderBy: { startsAt: "desc" },
    }),
    db.user.count({ where: { fantasyTeam: null } }),
    computeStandings(),
    getFantasyRankingSnapshotOrCompute(),
    db.group.findMany({
      orderBy: { order: "asc" },
      include: { teams: { select: { qualified: true } } },
    }),
  ]);

  const hasAnomalies = concludedNoPlayers.length > 0 || usersNoTeam > 0;
  const top3standings = standings.slice(0, 3);
  const top3rankings = rankings.slice(0, 3);

  const todayIso = new Date().toISOString().slice(0, 10);
  const [todayVisit, visitTotals] = await Promise.all([
    db.siteVisit.findUnique({ where: { date: todayIso } }),
    db.siteVisit.aggregate({ _sum: { count: true } }),
  ]);
  const visitesToday = todayVisit?.count ?? 0;
  const visitesTotal = visitTotals._sum.count ?? 0;

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long",
  });

  const concludedCount = await db.match.count({ where: { status: "CONCLUDED" } });

  const totalTeamsInGroups = groups.reduce((acc, g) => acc + g.teams.length, 0);
  const totalQualified = groups.reduce((acc, g) => acc + g.teams.filter((t) => t.qualified).length, 0);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="over-label mb-1">Area admin</div>
          <h1 className="font-display font-black text-3xl uppercase leading-none" style={{ color: "var(--text-primary)" }}>
            Dashboard
          </h1>
        </div>
        <span className="text-sm capitalize hidden sm:block pb-1" style={{ color: "var(--text-muted)" }}>
          {today}
        </span>
      </div>

      {/* ── Live match hero ─────────────────────────────────────────── */}
      {liveMatch && (
        <AdminMatchHero match={liveMatch} variant="live" />
      )}

      {/* ── Next match hero ─────────────────────────────────────────── */}
      {nextMatch ? (
        <AdminMatchHero match={nextMatch} variant="next" />
      ) : !liveMatch ? (
        <div
          className="rounded-[20px] px-5 py-6 flex items-center gap-4"
          style={{ background: "var(--surface-1)", border: "1px dashed var(--border-medium)" }}
        >
          <i className="pi pi-calendar text-2xl" style={{ color: "var(--text-disabled)" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Nessuna partita programmata</div>
            <Link href="/admin/partite" className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
              Crea una partita →
            </Link>
          </div>
        </div>
      ) : null}

      {/* ── Standings + Fanta rankings ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Torneo standings */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="over-label">Classifica torneo</div>
            <Link href="/admin/squadre" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--primary)" }}>
              Vedi squadre <i className="pi pi-arrow-right text-[9px]" />
            </Link>
          </div>
          {top3standings.length === 0 ? (
            <p className="px-4 py-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessuna partita conclusa.</p>
          ) : (
            top3standings.map((s) => (
              <div
                key={s.teamId}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border-soft)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                  style={
                    s.rank === 1
                      ? { background: "linear-gradient(135deg,#E8A000,#C87800)", color: "#fff" }
                      : s.rank === 2
                      ? { background: "var(--surface-2)", color: "var(--text-secondary)" }
                      : { background: "var(--surface-1)", color: "var(--text-muted)" }
                  }
                >
                  {s.rank}
                </div>
                <span className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {s.shortName ?? s.teamName}
                </span>
                <div className="text-right flex-shrink-0">
                  <span className="font-display font-black text-base" style={{ color: "var(--text-primary)" }}>{s.points}</span>
                  <span className="text-[10px] ml-0.5" style={{ color: "var(--text-muted)" }}>pt</span>
                </div>
              </div>
            ))
          )}
          {standings.length > 3 && (
            <Link
              href="/classifica-torneo"
              className="flex items-center justify-center gap-1 px-4 py-2.5 text-[11px] font-semibold transition-colors hover:bg-[var(--surface-1)]"
              style={{ color: "var(--text-muted)" }}
            >
              +{standings.length - 3} squadre <i className="pi pi-chevron-down text-[9px]" />
            </Link>
          )}
        </div>

        {/* Fanta rankings */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="over-label">Classifica fanta</div>
            <Link href="/admin/squadre-fantasy" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--primary)" }}>
              Vedi squadre <i className="pi pi-arrow-right text-[9px]" />
            </Link>
          </div>
          {top3rankings.length === 0 ? (
            <p className="px-4 py-5 text-sm text-center" style={{ color: "var(--text-muted)" }}>Nessun punto assegnato.</p>
          ) : (
            top3rankings.map((r) => (
              <div
                key={r.fantasyTeamId}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border-soft)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                  style={
                    r.rank === 1
                      ? { background: "linear-gradient(135deg,#E8A000,#C87800)", color: "#fff" }
                      : r.rank === 2
                      ? { background: "var(--surface-2)", color: "var(--text-secondary)" }
                      : { background: "var(--surface-1)", color: "var(--text-muted)" }
                  }
                >
                  {r.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{r.fantasyTeamName}</div>
                  <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{r.userName ?? "—"}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-display font-black text-base" style={{ color: "var(--primary)" }}>{r.totalPoints}</span>
                  <span className="text-[10px] ml-0.5" style={{ color: "var(--text-muted)" }}>pt</span>
                </div>
              </div>
            ))
          )}
          {rankings.length > 3 && (
            <Link
              href="/classifica-fanta"
              className="flex items-center justify-center gap-1 px-4 py-2.5 text-[11px] font-semibold transition-colors hover:bg-[var(--surface-1)]"
              style={{ color: "var(--text-muted)" }}
            >
              +{rankings.length - 3} squadre <i className="pi pi-chevron-down text-[9px]" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Recent results ─────────────────────────────────────────── */}
      {recentMatches.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="over-label">Ultimi risultati</div>
            <Link href="/admin/partite" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--primary)" }}>
              Tutte le partite <i className="pi pi-arrow-right text-[9px]" />
            </Link>
          </div>
          {recentMatches.map((m, idx) => {
            const home = m.homeTeam?.shortName ?? m.homeTeam?.name ?? m.homeSeed ?? "TBD";
            const away = m.awayTeam?.shortName ?? m.awayTeam?.name ?? m.awaySeed ?? "TBD";
            const homeWon = m.homeScore! > m.awayScore!;
            const draw = m.homeScore === m.awayScore;
            return (
              <Link
                key={m.id}
                href={`/admin/partite/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-1)] transition-colors"
                style={{ borderBottom: idx < recentMatches.length - 1 ? "1px solid var(--border-soft)" : undefined }}
              >
                {/* Home */}
                <span
                  className="flex-1 text-sm font-semibold truncate text-right"
                  style={{ color: homeWon ? "var(--text-primary)" : "var(--text-muted)", fontWeight: homeWon ? 700 : 400 }}
                >
                  {home}
                </span>
                {/* Score */}
                <div
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg"
                  style={{ background: draw ? "var(--surface-1)" : "var(--surface-2)", minWidth: "4rem", justifyContent: "center" }}
                >
                  <span className="font-display font-black text-base tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {m.homeScore}
                  </span>
                  <span className="text-xs font-black" style={{ color: "var(--text-disabled)" }}>—</span>
                  <span className="font-display font-black text-base tabular-nums" style={{ color: "var(--text-primary)" }}>
                    {m.awayScore}
                  </span>
                </div>
                {/* Away */}
                <span
                  className="flex-1 text-sm truncate"
                  style={{ color: !homeWon && !draw ? "var(--text-primary)" : "var(--text-muted)", fontWeight: !homeWon && !draw ? 700 : 400 }}
                >
                  {away}
                </span>
                <span className="text-[11px] flex-shrink-0 hidden sm:block" style={{ color: "var(--text-disabled)" }}>
                  {m.startsAt.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" })}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Stato gironi ───────────────────────────────────────────── */}
      {groups.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
            <div className="over-label">Stato gironi</div>
            <Link href="/admin/gironi" className="text-[11px] font-semibold flex items-center gap-1" style={{ color: "var(--primary)" }}>
              Gestisci <i className="pi pi-arrow-right text-[9px]" />
            </Link>
          </div>
          <div className="px-4 py-3 flex items-center gap-6 flex-wrap">
            {/* Group pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {groups.map((g) => {
                const qualified = g.teams.filter((t) => t.qualified).length;
                const total = g.teams.length;
                return (
                  <Link
                    key={g.id}
                    href={`/admin/gironi/${g.id}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
                    style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)" }}
                  >
                    <span className="font-display font-black text-sm" style={{ color: "var(--primary)" }}>
                      {g.slug}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {total}/4 squadre
                    </span>
                    {qualified > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#ECFDF5", color: "#065F46" }}
                      >
                        {qualified} Q
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            {/* Summary */}
            <div className="flex items-center gap-4 ml-auto">
              <div className="text-center">
                <div className="font-display font-black text-xl" style={{ color: "var(--text-primary)" }}>{totalTeamsInGroups}</div>
                <div className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>squadre</div>
              </div>
              <div className="text-center">
                <div className="font-display font-black text-xl" style={{ color: "#065F46" }}>{totalQualified}</div>
                <div className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-muted)" }}>qualificate</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[
          { label: "Squadre",   value: teamCount,        href: "/admin/squadre",         icon: "pi-shield"   },
          { label: "Giocatori", value: playerCount,      href: "/admin/giocatori",        icon: "pi-users"    },
          { label: "Partite",   value: matchCount,       href: "/admin/partite",          icon: "pi-calendar" },
          { label: "Utenti",    value: userCount,        href: "/admin/utenti",           icon: "pi-id-card"  },
          { label: "Fanta Allenatori", value: fantasyTeamCount, href: "/admin/squadre-fantasy", icon: "pi-trophy" },
        ].map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl p-3 flex flex-col gap-1.5 hover:-translate-y-px transition-all duration-150"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)" }}
          >
            <i className={`pi ${s.icon} text-sm`} style={{ color: "var(--primary)" }} />
            <div className="font-display font-black text-2xl leading-none" style={{ color: "var(--text-primary)" }}>
              {s.value}
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-wide leading-tight whitespace-normal break-words text-center"
              style={{ color: "var(--text-muted)" }}
              title={s.label}
            >
              {s.label}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Visite ─────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
          <div className="over-label">Visite al sito</div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--border-soft)]">
          {[
            { label: "Oggi",    value: visitesToday, icon: "pi-eye"  },
            { label: "Totali",  value: visitesTotal, icon: "pi-chart-line" },
            { label: "Utenti",  value: userCount,    icon: "pi-users" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 py-5 px-3 text-center">
              <i className={`pi ${s.icon} text-base`} style={{ color: "var(--primary)" }} />
              <div className="font-display font-black text-2xl leading-none" style={{ color: "var(--text-primary)" }}>
                {s.value}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Anomalie ───────────────────────────────────────────────── */}
      {hasAnomalies && (
        <div>
          <p className="over-label mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            Da verificare
          </p>
          <div className="flex flex-col gap-2.5">
            {concludedNoPlayers.map((m) => (
              <div
                key={m.id}
                className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", borderLeft: "3px solid #D97706" }}
              >
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {m.homeTeam?.name ?? m.homeSeed ?? "TBD"} vs {m.awayTeam?.name ?? m.awaySeed ?? "TBD"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#92400E" }}>
                    Partita conclusa senza giocatori
                  </p>
                </div>
                <Link
                  href={`/admin/partite/${m.id}`}
                  className="text-xs font-semibold flex-shrink-0 flex items-center gap-1"
                  style={{ color: "var(--primary)" }}
                >
                  Gestisci <i className="pi pi-arrow-right text-[10px]" />
                </Link>
              </div>
            ))}
            {usersNoTeam > 0 && (
              <div
                className="rounded-xl px-4 py-3 flex items-center justify-between gap-4"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)", borderLeft: "3px solid var(--primary)" }}
              >
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                  <span className="font-bold">{usersNoTeam}</span>{" "}
                  {usersNoTeam === 1 ? "utente senza squadra fanta" : "utenti senza squadra fanta"}
                </p>
                <Link href="/admin/utenti" className="text-xs font-semibold flex-shrink-0 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                  Vedi utenti <i className="pi pi-arrow-right text-[10px]" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── All ok ─────────────────────────────────────────────────── */}
      {!hasAnomalies && (concludedCount > 0 || matchCount > 0) && (
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium w-fit"
          style={{ background: "rgba(16,185,129,0.10)", color: "#065F46" }}
        >
          <i className="pi pi-check-circle text-sm" />
          Tutto ok
        </div>
      )}
    </div>
  );
}

function AdminMatchHero({
  match,
  variant,
}: {
  match: AdminDashboardMatch;
  variant: "live" | "next";
}) {
  const homeLabel = match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD";
  const awayLabel = match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD";
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const centerLabel = variant === "live"
    ? `${match.homeScore ?? 0} — ${match.awayScore ?? 0}`
    : "VS";
  const dotClass = variant === "live" ? "bg-red-500" : "bg-emerald-400";
  const title = variant === "live" ? "Partita in corso" : "Prossima partita";
  const background = variant === "live"
    ? "linear-gradient(145deg, #7F1D1D 0%, #0107A3 100%)"
    : "linear-gradient(145deg, #0107A3 0%, #000669 100%)";
  const shadow = variant === "live"
    ? "0 6px 32px rgba(127,29,29,0.32)"
    : "0 6px 32px rgba(1,7,163,0.32)";

  return (
    <Link
      href={`/admin/partite/${match.id}`}
      className="block rounded-[20px] overflow-hidden transition-transform hover:-translate-y-px"
      style={{ background, boxShadow: shadow }}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${dotClass} animate-pulse`} />
          <span className="text-[11px] font-black uppercase tracking-widest text-white/60">
            {title}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-white/50 capitalize">
          {match.startsAt.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}
          {" · "}
          {match.startsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
        </span>
      </div>

      <div className="px-5 py-5 flex items-center gap-3">
        <div className="flex-1 text-center">
          <div className="font-display font-black text-2xl sm:text-3xl uppercase leading-none tracking-tight text-white">
            {homeLabel}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mt-1 truncate">
            {match.homeTeam?.name ?? match.homeSeed ?? ""}
          </div>
        </div>
        <div className={`flex-shrink-0 font-display font-black leading-none text-white/30 px-2 ${hasScore || variant === "live" ? "text-3xl" : "text-2xl"}`}>
          {centerLabel}
        </div>
        <div className="flex-1 text-center">
          <div className="font-display font-black text-2xl sm:text-3xl uppercase leading-none tracking-tight text-white">
            {awayLabel}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mt-1 truncate">
            {match.awayTeam?.name ?? match.awaySeed ?? ""}
          </div>
        </div>
      </div>

      <div
        className="px-5 py-2.5 flex items-center justify-end gap-1"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="text-[11px] font-semibold text-white/40">Gestisci</span>
        <i className="pi pi-arrow-right text-[10px] text-white/40" />
      </div>
    </Link>
  );
}
