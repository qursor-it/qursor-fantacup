import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { addAllMatchPlayers } from "@/app/actions/admin/match-players";
import AdminPageHeader from "@/components/admin-page-header";
import EditMatchForm from "./_edit-form";
import AddMatchPlayerForm from "./_add-player-form";
import PlayerBonusCard from "./_player-bonus-card";
import StatusActions from "./_status-actions";
import GoalsForm from "./_goals-form";
import MvpOverrideForm from "./_mvp-override-form";
import StatusBadge from "@/components/status-badge";
import { Button } from "primereact/button";
import { resolveMvp } from "@/lib/domain/mvp";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

export default async function PartitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const matchId = parseId(id);
  if (matchId === null) notFound();

  const [match, teams, groups, rounds, bonusTypes, allPlayers, matchBonuses, matchGoals] = await Promise.all([
    db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true } },
        awayTeam: { select: { id: true, name: true, shortName: true } },
        group: { select: { id: true, name: true, slug: true } },
        knockoutRound: { select: { id: true, name: true } },
        players: {
          include: { player: { include: { footballTeam: { select: { name: true } } } } },
        },
        votes: { select: { playerId: true } },
      },
    }),
    db.footballTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.group.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, slug: true } }),
    db.knockoutRound.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.bonusType.findMany({ orderBy: { code: "asc" } }),
    db.player.findMany({ orderBy: { name: "asc" }, include: { footballTeam: { select: { name: true } } } }),
    db.playerMatchBonus.findMany({
      where: { matchId },
      include: { bonusType: true },
      orderBy: { id: "asc" },
    }),
    db.matchGoal.findMany({
      where: { matchId },
      include: { scorer: { select: { name: true, footballTeam: { select: { name: true } } } } },
      orderBy: { id: "asc" },
    }),
  ]);

  if (!match) notFound();

  const participantIds = new Set(match.players.map((mp) => mp.playerId));
  const eligibleTeamIds = new Set([match.homeTeamId, match.awayTeamId].filter((x): x is number => x !== null));
  const availablePlayers = allPlayers.filter(
    (p) => eligibleTeamIds.has(p.footballTeamId) && !participantIds.has(p.id)
  );
  const allEligibleCount = allPlayers.filter((p) => eligibleTeamIds.has(p.footballTeamId)).length;

  const bonusesByPlayer = new Map<number, typeof matchBonuses>();
  for (const b of matchBonuses) {
    const arr = bonusesByPlayer.get(b.playerId) ?? [];
    arr.push(b);
    bonusesByPlayer.set(b.playerId, arr);
  }

  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const mvpResolution = resolveMvp({
    concludedAt: match.concludedAt,
    votes: match.votes,
    mvpOverridePlayerId: match.mvpOverridePlayerId,
    eligiblePlayerIds: match.players.map((mp) => mp.playerId),
  });
  const playerById = new Map(match.players.map((mp) => [mp.playerId, mp.player]));
  const voteRows = mvpResolution.voteCounts
    .map((voteCount) => {
      const player = playerById.get(voteCount.playerId);
      return player
        ? {
            id: player.id,
            name: player.name,
            footballTeamName: player.footballTeam.name,
            votes: voteCount.votes,
          }
        : null;
    })
    .filter((row): row is { id: number; name: string; footballTeamName: string; votes: number } => row !== null);
  const mvpStatusLabel =
    mvpResolution.status === "open"
      ? "Finestra di voto aperta: l'MVP non assegna ancora punti."
      : mvpResolution.status === "resolved"
        ? `MVP ufficiale: ${playerById.get(mvpResolution.playerId)?.name ?? "giocatore selezionato"} (${mvpResolution.source === "admin" ? "scelto da admin" : "automatico"}).`
        : mvpResolution.status === "tied"
          ? "Pari voti: scegli manualmente l'MVP per assegnare i 5 punti."
          : "Finestra chiusa senza voti: nessun MVP assegnato.";

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader title="Gestione partita" backHref="/admin/partite" />

      {/* ── Hero banner ───────────────────────────────────────────── */}
      <div
        className="rounded-[20px] overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0107A3 0%, #000669 100%)", boxShadow: "0 6px 24px rgba(1,7,163,0.28)" }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-3 gap-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <StatusBadge status={match.status} />
            {match.group && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white/70" style={{ background: "rgba(255,255,255,0.12)" }}>
                Girone {match.group.slug}
              </span>
            )}
            {match.knockoutRound && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white/70" style={{ background: "rgba(255,255,255,0.12)" }}>
                {match.knockoutRound.name}
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold text-white/50 capitalize">
            {match.startsAt.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
          </span>
        </div>
        {/* Teams */}
        <div className="px-5 py-5 flex items-center gap-3">
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="font-display font-black text-2xl sm:text-3xl uppercase leading-none tracking-tight text-white text-center">
              {match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD"}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40 truncate max-w-full">
              {match.homeTeam?.name ?? match.homeSeed ?? "—"}
            </span>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center gap-1 px-2">
            {hasScore ? (
              <div className="font-display font-black text-4xl leading-none text-white">
                {match.homeScore}<span className="text-white/30"> — </span>{match.awayScore}
              </div>
            ) : (
              <>
                <div className="font-display font-black text-2xl leading-none text-white/30">VS</div>
                <div className="text-[11px] font-bold text-white/40 tabular-nums">
                  {match.startsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                </div>
              </>
            )}
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="font-display font-black text-2xl sm:text-3xl uppercase leading-none tracking-tight text-white text-center">
              {match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD"}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40 truncate max-w-full">
              {match.awayTeam?.name ?? match.awaySeed ?? "—"}
            </span>
          </div>
        </div>
        {/* Date strip when has score */}
        {hasScore && (
          <div
            className="px-5 py-2.5 text-center text-[11px] font-semibold text-white/40 capitalize"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            {match.startsAt.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
            {" · "}
            {match.startsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
          </div>
        )}
      </div>

      {/* ── Marcatori ─────────────────────────────────────────────── */}
      {match.players.length > 0 && (
        <GoalsForm
          matchId={matchId}
          homeTeamId={match.homeTeamId ?? 0}
          awayTeamId={match.awayTeamId ?? 0}
          homeTeamName={match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "Casa"}
          awayTeamName={match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "Ospite"}
          players={match.players.map(({ player }) => ({
            id: player.id,
            name: player.name,
            role: player.role,
            footballTeamId: player.footballTeamId,
            footballTeam: { name: player.footballTeam.name },
          }))}
          goals={matchGoals.map((g) => ({
            id: g.id,
            scorerId: g.scorerId,
            isOwnGoal: g.isOwnGoal,
            scorer: { name: g.scorer.name, footballTeam: { name: g.scorer.footballTeam.name } },
          }))}
        />
      )}

      {/* ── Status actions ────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="over-label mb-3">Avanzamento stato</div>
        <StatusActions matchId={matchId} status={match.status} playerCount={match.players.length} />
      </div>

      {match.status === "CONCLUDED" && (
        <MvpOverrideForm
          matchId={matchId}
          currentPlayerId={match.mvpOverridePlayerId}
          statusLabel={mvpStatusLabel}
          voteRows={voteRows}
          players={match.players.map(({ player }) => ({
            id: player.id,
            name: player.name,
            footballTeamName: player.footballTeam.name,
          }))}
        />
      )}

      {/* ── Edit form (collapsible) ───────────────────────────────── */}
      <details className="card overflow-hidden group">
        <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-[var(--surface-1)] transition-colors">
          <i className="pi pi-pencil text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-semibold flex-1" style={{ color: "var(--text-secondary)" }}>
            Modifica dati partita
          </span>
          <i className="pi pi-chevron-down text-xs transition-transform group-open:rotate-180" style={{ color: "var(--text-disabled)" }} />
        </summary>
        <div className="px-4 pb-5 pt-1" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <EditMatchForm match={match} teams={teams} groups={groups} rounds={rounds} />
        </div>
      </details>

      {/* ── Participants ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="over-label">Partecipanti</div>
            <div className="text-sm font-semibold mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {match.players.length}
              {allEligibleCount > 0 && <span style={{ color: "var(--text-disabled)" }}> / {allEligibleCount}</span>}
              {" "}giocatori
            </div>
          </div>
          {availablePlayers.length > 0 && (
            <form action={addAllMatchPlayers as unknown as (fd: FormData) => void}>
              <input type="hidden" name="matchId" value={matchId} />
              <Button
                type="submit"
                label={`Aggiungi tutti (${availablePlayers.length})`}
                size="small"
                severity="secondary"
                icon="pi pi-users"
              />
            </form>
          )}
        </div>

        {match.players.length === 0 && (
          <div
            className="rounded-xl px-4 py-6 text-center"
            style={{ background: "var(--surface-1)", border: "1px dashed var(--border-medium)" }}
          >
            <i className="pi pi-users text-2xl mb-2 block" style={{ color: "var(--text-disabled)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nessun partecipante aggiunto.</p>
          </div>
        )}

        {match.players.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {match.players.map(({ player }) => (
              <PlayerBonusCard
                key={player.id}
                matchId={matchId}
                player={player}
                bonuses={(bonusesByPlayer.get(player.id) ?? []).map((b) => ({
                  id: b.id,
                  bonusType: { code: b.bonusType.code },
                  quantity: b.quantity,
                  points: Number(b.points),
                }))}
                bonusTypes={bonusTypes.map((bt) => ({
                  id: bt.id,
                  code: bt.code,
                  name: bt.name,
                  points: Number(bt.points),
                }))}
              />
            ))}
          </div>
        )}

        {availablePlayers.length > 0 && (
          <AddMatchPlayerForm matchId={matchId} availablePlayers={availablePlayers} />
        )}
      </div>
    </div>
  );
}
