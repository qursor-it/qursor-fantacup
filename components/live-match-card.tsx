import Link from "next/link";
import { resolveTeamFlag } from "@/lib/flags";
import LiveMatchClock from "@/components/live-match-clock";
import { getMatchClockNow } from "@/lib/domain/match";

type Team = {
  id: number;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  logoUrl: string | null;
};

type Props = {
  match: {
    id: number;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: Team;
    awayTeam: Team;
    group: { name: string } | null;
    knockoutRound: { name: string } | null;
    startsAt: Date;
  };
};

function TeamLogo({ team }: { team: Team }) {
  const src = resolveTeamFlag(team);
  return (
    <div
      className="flex items-center justify-center rounded-[18px]"
      style={{
        width: 72, height: 72,
        background: "#0f195a",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 10px 10px rgba(0,0,0,0.4)",
      }}
    >
      {src ? (
        <img src={src} alt={team.name} width={52} style={{ height: "auto" }} />
      ) : (
        <span className="text-xl font-black text-white">
          {(team.shortName ?? team.name).slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function LiveMatchCard({ match: m }: Props) {
  const label = m.group?.name ?? m.knockoutRound?.name ?? null;
  const date = m.startsAt.toLocaleDateString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC",
  });
  const homeScore = m.homeScore ?? 0;
  const awayScore = m.awayScore ?? 0;
  const elapsedMsAtLoad = getMatchClockNow().getTime() - m.startsAt.getTime();

  return (
      <Link
        href={`/partite/${m.id}`}
        className="flex flex-col gap-4 rounded-3xl p-6 w-full"
        style={{
          background: "#09144c",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 0 24px 0 rgba(255,31,31,0.10), 0 18px 40px -12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Top row: LIVE · score · clock */}
        <div
          className="flex items-center gap-2 sm:gap-4 px-3.5 py-2.5 rounded-2xl"
          style={{ background: "#0f195a", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {/* Live badge */}
          <div className="flex flex-1 items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span
                className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff1f1f]"
                style={{ boxShadow: "0 0 10px 0 rgba(255,31,31,0.4)" }}
              />
            </span>
            <span className="text-xs font-extrabold text-[#ff1f1f] uppercase tracking-wide truncate">LIVE</span>
          </div>

          {/* Score */}
          <span className="shrink-0 text-center text-4xl font-black text-white tabular-nums whitespace-nowrap">
            {homeScore} - {awayScore}
          </span>

          {/* Clock */}
          <div className="flex flex-1 justify-end shrink-0">
            <LiveMatchClock key={elapsedMsAtLoad} elapsedMsAtLoad={elapsedMsAtLoad} />
          </div>
        </div>

        {/* Match info */}
        <div className="flex flex-col items-center gap-1.5">
          {label && (
            <span className="text-xs font-semibold uppercase text-white/70">{label}</span>
          )}
          <span className="text-xs font-medium text-white/50">{date}</span>
        </div>

        {/* Teams */}
        <div className="flex items-center gap-6 w-full">
          <div className="flex flex-1 flex-col items-center gap-2 min-w-0">
            <TeamLogo team={m.homeTeam} />
            <span className="text-sm font-bold text-white text-center truncate w-full">
              {m.homeTeam.shortName ?? m.homeTeam.name}
            </span>
          </div>

          <span className="text-sm font-extrabold text-white/50 uppercase shrink-0">vs</span>

          <div className="flex flex-1 flex-col items-center gap-2 min-w-0">
            <TeamLogo team={m.awayTeam} />
            <span className="text-sm font-bold text-white text-center truncate w-full">
              {m.awayTeam.shortName ?? m.awayTeam.name}
            </span>
          </div>
        </div>
      </Link>
  );
}
