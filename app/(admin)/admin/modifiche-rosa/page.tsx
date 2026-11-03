import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import { isEditWindowOpen } from "@/lib/domain/roster-edit-window";
import WindowForm from "./_form";
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

export default async function ModificheRosaPage() {
  await requireAdmin();
  const now = new Date();

  // Finestra modificabile: l'ultima non ancora chiusa (attiva o programmata).
  const editable = await db.rosterEditWindow.findFirst({
    where: { closesAt: { gt: now } },
    orderBy: { opensAt: "desc" },
  });

  const isActive = isEditWindowOpen(editable, now);

  const usages = editable
    ? await db.rosterEditUsage.findMany({
        where: { windowId: editable.id },
        include: { fantasyTeam: { include: { user: { select: { email: true } } } } },
        orderBy: { changesUsed: "desc" },
      })
    : [];

  // Default sensati quando non c'è una finestra aperta/programmata.
  const defaultOpens = new Date(now);
  const defaultCloses = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  let statusLabel = "Nessuna finestra programmata";
  let statusColor = "var(--text-muted)";
  let statusBg = "var(--surface-1)";
  if (editable && isActive) {
    statusLabel = `Aperta — chiude il ${fmt(editable.closesAt)}`;
    statusColor = "#1A7F37";
    statusBg = "rgba(50,215,75,0.10)";
  } else if (editable) {
    statusLabel = `Programmata — apre il ${fmt(editable.opensAt)}`;
    statusColor = "#B45309";
    statusBg = "rgba(245,158,11,0.10)";
  }

  return (
    <div>
      <AdminPageHeader title="Modifiche rosa" />

      <div className="card flex flex-col gap-5 p-5">
        <div
          className="flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold"
          style={{ background: statusBg, color: statusColor }}
        >
          <i className={`pi ${isActive ? "pi-unlock" : "pi-clock"} text-xs`} />
          {statusLabel}
        </div>

        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Apri un periodo in cui tutti gli utenti possono modificare la propria rosa, con un numero massimo di
          sostituzioni di giocatori. Il cambio di capitano è sempre libero. Il nome squadra resta bloccato.
        </p>

        <WindowForm
          opensAt={editable?.opensAt ?? defaultOpens}
          closesAt={editable?.closesAt ?? defaultCloses}
          maxChanges={editable?.maxChanges ?? 2}
          isActive={isActive}
        />
      </div>

      {editable && (
        <div className="card mt-6 overflow-hidden p-0">
          <div className="px-5 pt-5 pb-2">
            <h2 className="font-display text-base font-black uppercase" style={{ color: "var(--text-primary)" }}>
              Cambi effettuati
            </h2>
          </div>
          {usages.length === 0 ? (
            <p className="px-5 pb-5 text-sm" style={{ color: "var(--text-muted)" }}>
              Nessun utente ha ancora modificato la rosa in questa finestra.
            </p>
          ) : (
            <div>
              {usages.map((u) => (
                <div
                  key={u.fantasyTeamId}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                  style={{ borderTop: "1px solid var(--border-soft)" }}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {u.fantasyTeam.name}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--text-muted)" }}>
                      {u.fantasyTeam.user.email}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                  >
                    {u.changesUsed}/{editable.maxChanges} cambi
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
