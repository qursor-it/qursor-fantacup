import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AdminPageHeader from "@/components/admin-page-header";
import UserActionsForm from "./_actions-form";
import AdminSetPasswordForm from "./_set-password-form";
import RoleBadge from "@/components/role-badge";
import { parseId } from "@/lib/parse-id";
import { requireAdmin } from "@/lib/session";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border-soft)" }}>
      <span className="text-[11px] font-black uppercase tracking-wide w-28 flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-sm flex-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function formatDate(d: Date) {
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateTime(d: Date | null) {
  if (!d) return <span style={{ color: "var(--text-disabled)" }}>Mai</span>;
  return d.toLocaleString("it-IT", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function UtenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const userId = parseId(id);
  if (userId === null) notFound();
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      fantasyTeam: {
        include: {
          players: {
            include: {
              player: {
                select: { id: true, name: true, role: true, footballTeam: { select: { name: true } } },
              },
            },
          },
          captain: { select: { id: true, name: true } },
        },
      },
      _count: { select: { votes: true } },
    },
    omit: { passwordHash: true },
  });
  if (!user) notFound();

  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Dettaglio utente" backHref="/admin/utenti" />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div
        className="rounded-[20px] px-5 py-5 flex items-center gap-4"
        style={{ background: "linear-gradient(145deg, #0107A3 0%, #000669 100%)", boxShadow: "0 6px 24px rgba(1,7,163,0.25)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black flex-shrink-0 text-white"
          style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.2)" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-lg uppercase text-white leading-tight truncate">
            {user.name ?? user.email}
          </div>
          {user.name && (
            <div className="text-[12px] text-white/50 truncate mt-0.5">{user.email}</div>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {user.role === "ADMIN" ? (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(232,160,0,0.25)", color: "#E8A000", border: "1px solid rgba(232,160,0,0.4)" }}
              >
                ADMIN
              </span>
            ) : (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
              >
                USER
              </span>
            )}
            {user.isSuspended && (
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(239,68,68,0.25)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.4)" }}
              >
                SOSPESO
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Azioni ───────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="over-label mb-3">Azioni</div>
        <UserActionsForm userId={user.id} isSuspended={user.isSuspended} isAdmin={user.role === "ADMIN"} userEmail={user.email} />
      </div>

      {/* ── Imposta password ─────────────────────────────────────── */}
      <div className="card p-4">
        <div className="over-label mb-4">Imposta password</div>
        <AdminSetPasswordForm userId={user.id} />
      </div>

      {/* ── Info account ─────────────────────────────────────────── */}
      <div className="card px-4 py-1">
        <div className="over-label py-2.5">Account</div>
        <InfoRow label="Email" value={user.email} />
        <InfoRow label="Nome" value={user.name ?? <span style={{ color: "var(--text-disabled)" }}>—</span>} />
        <InfoRow label="Ruolo" value={user.role} />
        <InfoRow label="Iscritto il" value={formatDate(user.createdAt)} />
        <InfoRow label="Ultimo accesso" value={formatDateTime(user.lastLoginAt)} />
        <InfoRow label="Voti MVP" value={`${user._count.votes} vot${user._count.votes === 1 ? "o" : "i"}`} />
        <div className="py-2.5">
          <InfoRow
            label="Stato"
            value={
              user.isSuspended
                ? <span style={{ color: "#991B1B" }}>Sospeso</span>
                : <span style={{ color: "#065F46" }}>Attivo</span>
            }
          />
        </div>
      </div>

      {/* ── Squadra fanta ────────────────────────────────────────── */}
      <div className="card px-4 py-1">
        <div className="flex items-center justify-between py-2.5">
          <div className="over-label">Squadra fanta</div>
          {user.fantasyTeam && (
            <Link
              href={`/admin/squadre-fantasy/${user.fantasyTeam.id}`}
              className="text-xs font-semibold flex items-center gap-1 flex-shrink-0"
              style={{ color: "var(--primary)" }}
            >
              Gestisci rosa
              <i className="pi pi-arrow-right text-[10px]" />
            </Link>
          )}
        </div>

        {!user.fantasyTeam ? (
          <div className="pb-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Nessuna squadra fanta creata.
          </div>
        ) : (
          <>
            <InfoRow label="Nome squadra" value={
              <span className="font-display font-black uppercase">{user.fantasyTeam.name}</span>
            } />
            <InfoRow label="Capitano" value={user.fantasyTeam.captain.name} />
            <InfoRow label="Giocatori" value={`${user.fantasyTeam.players.length} / 5`} />

            {/* Player list */}
            {user.fantasyTeam.players.length > 0 && (
              <div className="py-3">
                <div className="text-[11px] font-black uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                  Rosa
                </div>
                <div className="flex flex-col gap-1.5">
                  {user.fantasyTeam.players.map(({ player }) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                      style={{ background: "var(--surface-1)", border: "1px solid var(--border-soft)" }}
                    >
                      <RoleBadge role={player.role} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                          {player.name}
                        </span>
                        {player.id === user.fantasyTeam!.captain.id && (
                          <span
                            className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(232,160,0,0.15)", color: "#92400E" }}
                          >
                            CAP
                          </span>
                        )}
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {player.footballTeam.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
