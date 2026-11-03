import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";
import MvpDetailTabs from "@/components/mvp-detail-tabs";
import { getMvpMatchDetail } from "@/lib/data/public/mvp";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export const revalidate = 60;

export default async function MvpDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const matchIdNum = Number(matchId);
  if (!Number.isInteger(matchIdNum) || matchIdNum <= 0) notFound();
  const [detail, user] = await Promise.all([
    getMvpMatchDetail(matchIdNum),
    getCurrentUser(),
  ]);
  if (!detail) notFound();

  // Se l'utente è loggato, carica il suo team per evidenziare capitano e rosa
  let captainPlayerId: number | null = null;
  let rosterPlayerIds: number[] = [];
  if (user) {
    const fantasyTeam = await db.fantasyTeam.findUnique({
      where: { userId: Number(user.id) },
      select: {
        captainPlayerId: true,
        players: { select: { playerId: true } },
      },
    });
    if (fantasyTeam) {
      captainPlayerId = fantasyTeam.captainPlayerId;
      rosterPlayerIds = fantasyTeam.players.map((p) => p.playerId);
    }
  }

  const { match } = detail;

  return (
    <div className="flex flex-col gap-10">

      {/* Header */}
      <div className="flex items-center">
        <BackButton />
      </div>

      {/* Score card */}
      <div
        className="rounded-3xl p-6 w-full"
        style={{
          background: "#fff",
          border: "1px solid rgba(9,20,76,0.05)",
          boxShadow: "0 4px 10px 0 rgba(9,20,76,0.10)",
        }}
      >
        <div className="flex gap-3 items-center w-full">

          {/* Home team */}
          <div className="flex flex-1 flex-col gap-4 items-center justify-center min-w-0">
            {match.homeTeamFlagSrc ? (
              <img src={match.homeTeamFlagSrc} alt={match.homeTeamName} width={56} height={38} className="object-contain" />
            ) : (
              <div className="w-14 h-10 rounded flex items-center justify-center" style={{ background: "rgba(9,20,76,0.06)" }}>
                <span className="text-xs font-bold" style={{ color: "#000" }}>
                  {match.homeTeamName.slice(0, 3).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-xs text-center" style={{ color: "#000" }}>
              {match.homeTeamName}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center justify-center leading-normal shrink-0">
            <span className="font-bold uppercase" style={{ fontSize: 24, color: "#000" }}>
              {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
            </span>
            <span className="font-light" style={{ fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
              Fischio finale
            </span>
          </div>

          {/* Away team */}
          <div className="flex flex-1 flex-col gap-4 items-center justify-center min-w-0">
            {match.awayTeamFlagSrc ? (
              <img src={match.awayTeamFlagSrc} alt={match.awayTeamName} width={56} height={38} className="object-contain" />
            ) : (
              <div className="w-14 h-10 rounded flex items-center justify-center" style={{ background: "rgba(9,20,76,0.06)" }}>
                <span className="text-xs font-bold" style={{ color: "#000" }}>
                  {match.awayTeamName.slice(0, 3).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-xs text-center" style={{ color: "#000" }}>
              {match.awayTeamName}
            </span>
          </div>

        </div>
      </div>

      {/* Tabs: Info partita / Punteggi */}
      <MvpDetailTabs
        detail={detail}
        captainPlayerId={captainPlayerId}
        rosterPlayerIds={rosterPlayerIds}
      />

    </div>
  );
}
