import BackChevron from "@/components/back-chevron";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { isMvpWindowOpen } from "@/lib/domain/vote";
import { resolveMvp } from "@/lib/domain/mvp";
import { resolveTeamFlag } from "@/lib/flags";
import VoteForm from "./_vote-form";

export default async function VotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) notFound();
  const matchId = Number(id);
  if (!Number.isSafeInteger(matchId) || matchId > 2_147_483_647) notFound();
  const user = await requireAuth();
  const userId = Number(user.id);

  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
      group: { select: { name: true } },
      knockoutRound: { select: { name: true } },
      players: {
        include: {
          player: {
            select: {
              id: true,
              name: true,
              role: true,
              footballTeamId: true,
              footballTeam: { select: { id: true, name: true, shortName: true, countryCode: true, logoUrl: true } },
            },
          },
        },
        orderBy: { player: { name: "asc" } },
      },
      votes: { select: { playerId: true } },
    },
  });
  if (!match) notFound();

  const windowOpen = isMvpWindowOpen(match.concludedAt);
  const userVote = await db.vote.findUnique({
    where: { userId_matchId: { userId, matchId } },
    include: {
      player: {
        select: {
          name: true,
          footballTeam: { select: { countryCode: true, logoUrl: true, name: true } },
        },
      },
    },
  });

  if (match.status === "DRAFT" || match.status === "SCHEDULED") {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-sm text-black/40">La partita non è ancora conclusa.</p>
        <Link href="/partite" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-(--text-primary)">
          <i className="pi pi-arrow-left" style={{ fontSize: 10 }} />
          Tutte le partite
        </Link>
      </div>
    );
  }

  const scored = match.homeScore !== null && match.awayScore !== null;
  const label = match.group?.name ?? match.knockoutRound?.name ?? null;
  const mvpResolution = resolveMvp({
    concludedAt: match.concludedAt,
    votes: match.votes,
    mvpOverridePlayerId: match.mvpOverridePlayerId,
    eligiblePlayerIds: match.players.map((mp) => mp.playerId),
  });
  const mvpPlayer = mvpResolution.status === "resolved"
    ? match.players.find((mp) => mp.playerId === mvpResolution.playerId)?.player
    : null;

  const TeamLogo = ({ team }: { team: { name: string; countryCode: string | null; logoUrl: string | null } | null }) => {
    if (!team) return <div style={{ width: 64, height: 64 }} />;
    const src = resolveTeamFlag(team);
    return (
      <div className="flex items-center justify-center shrink-0" style={{ width: 64, height: 64, padding: 4 }}>
        {src ? (
          <img src={src} alt={team.name} className="w-full h-auto object-contain" />
        ) : (
          <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white font-black text-lg">{team.name.slice(0, 2).toUpperCase()}</div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto w-full flex flex-col gap-10">

      {/* Back + title */}
      <div className="flex items-center relative">
        <BackChevron />
        <h1
          className="uppercase font-medium text-(--text-primary) mx-auto"
          style={{ fontFamily: "var(--font-tallica)", fontSize: 20 }}
        >
          MVP della giornata
        </h1>
      </div>

      {/* Match card */}
      <div
        className="bg-white rounded-3xl overflow-hidden"
        style={{ border: "1px solid rgba(9,20,76,0.05)", boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)" }}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
            <TeamLogo team={match.homeTeam} />
            <span className="text-sm text-black text-center leading-tight">
              {match.homeTeam?.shortName ?? match.homeTeam?.name ?? match.homeSeed ?? "TBD"}
            </span>
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0 text-center overflow-hidden whitespace-nowrap">
            {label && <span className="text-xs font-light" style={{ color: "rgba(0,0,0,0.65)" }}>{label}</span>}
            {scored ? (
              <span className="font-bold text-black tabular-nums" style={{ fontSize: 24 }}>
                {match.homeScore} - {match.awayScore}
              </span>
            ) : (
              <span className="font-bold text-black" style={{ fontSize: 24 }}>
                {match.startsAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
              </span>
            )}
            <span className="text-xs font-light" style={{ color: "rgba(0,0,0,0.65)" }}>
              {match.startsAt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })}
            </span>
          </div>
          <div className="flex flex-col items-center gap-3 flex-1 min-w-0">
            <TeamLogo team={match.awayTeam} />
            <span className="text-sm text-black text-center leading-tight">
              {match.awayTeam?.shortName ?? match.awayTeam?.name ?? match.awaySeed ?? "TBD"}
            </span>
          </div>
        </div>
      </div>

      {/* Voting section */}
      {windowOpen ? (
        <VoteForm
          matchId={matchId}
          userVote={userVote ? {
            playerName: userVote.player.name,
            team: userVote.player.footballTeam,
          } : null}
          homeTeam={match.homeTeam ? {
            id: match.homeTeam.id,
            name: match.homeTeam.shortName ?? match.homeTeam.name,
            countryCode: match.homeTeam.countryCode,
            logoUrl: match.homeTeam.logoUrl,
          } : null}
          awayTeam={match.awayTeam ? {
            id: match.awayTeam.id,
            name: match.awayTeam.shortName ?? match.awayTeam.name,
            countryCode: match.awayTeam.countryCode,
            logoUrl: match.awayTeam.logoUrl,
          } : null}
          players={match.players.map((mp) => ({
            id: mp.player.id,
            name: mp.player.name,
            role: mp.player.role,
            footballTeamId: mp.player.footballTeamId,
            footballTeam: {
              id: mp.player.footballTeam.id,
              name: mp.player.footballTeam.shortName ?? mp.player.footballTeam.name,
              countryCode: mp.player.footballTeam.countryCode,
              logoUrl: mp.player.footballTeam.logoUrl,
            },
          }))}
        />
      ) : (
        <div
          className="bg-white rounded-3xl p-6 text-center"
          style={{ border: "1px solid rgba(9,20,76,0.05)", boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)" }}
        >
          <p className="text-sm text-black/60">La finestra di voto è chiusa.</p>
          {mvpPlayer ? (
            <p className="mt-2 text-base font-semibold text-(--text-primary)">
              MVP ufficiale: {mvpPlayer.name}
            </p>
          ) : mvpResolution.status === "tied" ? (
            <p className="mt-2 text-xs text-black/50">Pari voti: l'MVP sarà confermato da un admin.</p>
          ) : (
            <p className="mt-2 text-xs text-black/50">Nessun MVP assegnato per questa partita.</p>
          )}
        </div>
      )}
    </div>
  );
}
