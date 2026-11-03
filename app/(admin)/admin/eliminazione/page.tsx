import Link from "next/link";
import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import { InitBracketForm, DeleteBracketForm, AssignTeamsForm } from "./_actions";
import { requireAdmin } from "@/lib/session";
export const dynamic = 'force-dynamic'


export default async function EliminazioneAdminPage() {
  await requireAdmin();
  const [rounds, qualifiedTeams] = await Promise.all([
    db.knockoutRound.findMany({
      orderBy: { order: "asc" },
      include: {
        matches: {
          orderBy: { bracketPosition: "asc" },
          include: {
            homeTeam: { select: { name: true, shortName: true } },
            awayTeam: { select: { name: true, shortName: true } },
          },
        },
      },
    }),
    db.footballTeam.findMany({
      where: { groupTeams: { some: { qualified: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const hasBracket = rounds.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Eliminazione diretta" backHref="/admin" />

      {!hasBracket ? (
        /* ── No bracket yet ───────────────────────────────────────── */
        <div className="card p-6 flex flex-col gap-4 max-w-md">
          <div className="over-label mb-1">Bracket non ancora inizializzato</div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Il bracket si basa su una struttura fissa: 4 quarti di finale, 2 semifinali,
            finale 3°/4° posto e finale. Inizializzandolo vengono creati i match placeholder
            che poi vengono assegnati alle squadre qualificate.
          </p>
          {qualifiedTeams.length < 8 && (
            <p className="text-sm" style={{ color: "#D97706" }}>
              Attenzione: solo {qualifiedTeams.length} squadre su 8 sono qualificate. Verifica i gironi.
            </p>
          )}
          <InitBracketForm />
        </div>
      ) : (
        /* ── Bracket exists ────────────────────────────────────────── */
        <div className="flex flex-col gap-5">
          {rounds.map((round) => (
            <div key={round.id} className="card overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <div className="over-label">{round.name}</div>
              </div>

              <div className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
                {round.matches.map((m) => {
                  const home = m.homeTeam?.shortName ?? m.homeTeam?.name ?? m.homeSeed ?? "TBD";
                  const away = m.awayTeam?.shortName ?? m.awayTeam?.name ?? m.awaySeed ?? "TBD";
                  const hasTeams = m.homeTeamId !== null && m.awayTeamId !== null;
                  const scored = m.homeScore !== null && m.awayScore !== null;

                  return (
                    <div key={m.id} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Position */}
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                        >
                          {m.bracketPosition}
                        </div>

                        {/* Teams / seeds */}
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-black text-sm uppercase" style={{ color: "var(--text-primary)" }}>
                            {home} <span style={{ color: "var(--text-disabled)", fontWeight: 400 }}>vs</span> {away}
                          </div>
                          {!hasTeams && (
                            <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              Seed: {m.homeSeed} vs {m.awaySeed}
                            </div>
                          )}
                        </div>

                        {/* Score or status */}
                        {scored ? (
                          <span className="font-display font-black text-sm flex-shrink-0" style={{ color: "var(--text-primary)" }}>
                            {m.homeScore} — {m.awayScore}
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
                          >
                            {m.status}
                          </span>
                        )}

                        {/* Manage link */}
                        {hasTeams && (
                          <Link
                            href={`/admin/partite/${m.id}`}
                            className="text-[11px] font-semibold flex items-center gap-1 flex-shrink-0"
                            style={{ color: "var(--primary)" }}
                          >
                            Gestisci <i className="pi pi-arrow-right text-[9px]" />
                          </Link>
                        )}
                      </div>

                      {/* Assign teams form — only for TBD matches */}
                      {!hasTeams && qualifiedTeams.length > 0 && (
                        <div className="mt-2 pl-9">
                          <AssignTeamsForm matchId={m.id} teams={qualifiedTeams} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Danger zone */}
          <div className="card p-5 max-w-sm">
            <div className="over-label mb-3">Zona pericolo</div>
            <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
              Elimina tutti i turni e i match placeholder TBD. I match già assegnati con squadre reali non vengono eliminati.
            </p>
            <DeleteBracketForm />
          </div>
        </div>
      )}
    </div>
  );
}
