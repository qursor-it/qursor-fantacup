import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import ConfirmDeleteForm from "@/components/confirm-delete-form";
import { computeCurrentPhaseRankings } from "@/lib/scoring";
import { deleteScoringPhase } from "@/app/actions/admin/scoring-phases";
import ClosePhaseForm from "./_close-form";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

function fmt(d: Date): string {
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

export default async function FasiPunteggioPage() {
  await requireAdmin();
  const [phases, currentRanking] = await Promise.all([
    db.scoringPhase.findMany({
      orderBy: { order: "desc" },
      include: { scores: { include: { fantasyTeam: { select: { name: true } } } } },
    }),
    computeCurrentPhaseRankings(),
  ]);

  const lastPhaseId = phases[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Fasi punteggio" />

      <div className="card flex flex-col gap-4 p-5">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Chiudendo una fase, i punti attuali di ogni squadra vengono congelati come storico e la fase successiva riparte
          da zero. Puoi farlo anche spuntando &quot;Salva storico punteggio&quot; all&apos;apertura del mercato.
        </p>
        <ClosePhaseForm />
      </div>

      {/* Fase in corso (live) */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h2 className="font-display text-base font-black uppercase" style={{ color: "var(--text-primary)" }}>
            Fase in corso
          </h2>
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#1A7F37" }}>
            live
          </span>
        </div>
        <PhaseScores rows={currentRanking.map((r) => ({ name: r.fantasyTeamName, points: r.totalPoints }))} />
      </div>

      {/* Fasi chiuse */}
      {phases.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nessuna fase chiusa.</p>
      ) : (
        phases.map((phase) => {
          const rows = phase.scores
            .map((s) => ({ name: s.fantasyTeam.name, points: Number(s.points) }))
            .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "it"));
          return (
            <div key={phase.id} className="card overflow-hidden p-0">
              <div className="px-5 pt-5 pb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-black uppercase truncate" style={{ color: "var(--text-primary)" }}>
                    {phase.order}. {phase.name}
                  </h2>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chiusa il {fmt(phase.closedAt)}</p>
                </div>
                {phase.id === lastPhaseId && (
                  <ConfirmDeleteForm
                    action={deleteScoringPhase}
                    hiddenInputs={{ id: phase.id }}
                    confirmMessage={`Eliminare la fase "${phase.name}"? I punti congelati verranno persi.`}
                  />
                )}
              </div>
              <PhaseScores rows={rows} />
            </div>
          );
        })
      )}
    </div>
  );
}

function PhaseScores({ rows }: { rows: { name: string; points: number }[] }) {
  if (rows.length === 0) {
    return <p className="px-5 pb-5 text-sm" style={{ color: "var(--text-muted)" }}>Nessuna squadra.</p>;
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={`${r.name}-${i}`}
          className="flex items-center justify-between gap-3 px-5 py-2.5"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold tabular-nums w-5 text-right" style={{ color: "var(--text-disabled)" }}>
              {i + 1}
            </span>
            <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{r.name}</span>
          </div>
          <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--primary)" }}>
            {r.points.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}
