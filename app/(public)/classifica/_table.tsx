"use client";

import Link from "next/link";

type RankRow = {
  rank: number;
  fantasyTeamId: number;
  fantasyTeamName: string;
  userId: number;
  userName: string | null;
  totalPoints: number;
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div
        className="w-8 h-8 rounded-[9px] flex items-center justify-center font-display font-black text-sm text-white flex-shrink-0"
        style={{
          background: "linear-gradient(135deg, #E8A000, #C87800)",
          boxShadow: "0 3px 10px rgba(232,160,0,0.5)",
        }}
      >
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div
        className="w-8 h-8 rounded-[9px] flex items-center justify-center font-display font-black text-sm flex-shrink-0"
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
      >
        2
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-[9px] flex items-center justify-center font-display font-black text-sm flex-shrink-0"
      style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}
    >
      {rank}
    </div>
  );
}

export default function ClassificaTable({ rows }: { rows: RankRow[] }) {
  const top2 = rows.filter((r) => r.rank <= 2);
  const rest = rows.filter((r) => r.rank > 2);

  return (
    <div className="flex flex-col gap-3">
      {/* Podio top-2 */}
      {top2.length > 0 && (
        <div
          className="rounded-[18px] p-4 relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #0107A3 0%, #000669 100%)",
            boxShadow: "0 6px 24px rgba(1,7,163,0.30)",
          }}
        >
          {/* Decorative */}
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 rounded-full border border-white/5 pointer-events-none" />
          <div className="absolute right-[10px] top-[10px] w-16 h-16 rounded-full border border-white/5 pointer-events-none" />

          {top2.map((row, idx) => (
            <div key={row.fantasyTeamId}>
              {idx > 0 && <div className="my-3" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }} />}
              <div className="flex items-center gap-3 relative">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center font-display font-black text-base flex-shrink-0"
                  style={
                    idx === 0
                      ? {
                          background: "linear-gradient(135deg, #E8A000, #C87800)",
                          boxShadow: "0 3px 10px rgba(232,160,0,0.5)",
                          color: "#fff",
                        }
                      : { background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {row.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/squadre-fanta/${row.fantasyTeamId}`} className="hover:underline">
                    <div
                      className="font-display font-black text-[14px] uppercase truncate"
                      style={{ color: idx === 0 ? "#fff" : "rgba(255,255,255,0.85)" }}
                    >
                      {row.fantasyTeamName}
                    </div>
                  </Link>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {row.userName ?? "Utente"}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className="font-display font-black text-2xl leading-none"
                    style={{ color: idx === 0 ? "#E8A000" : "rgba(255,255,255,0.55)" }}
                  >
                    {row.totalPoints.toFixed(1)}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>pt</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dal 3° in poi */}
      {rest.length > 0 && (
        <div className="card overflow-hidden">
          {rest.map((row, idx) => (
            <div
              key={row.fantasyTeamId}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-1)]"
              style={idx < rest.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : {}}
            >
              <RankBadge rank={row.rank} />
              <div className="flex-1 min-w-0">
                <Link href={`/squadre-fanta/${row.fantasyTeamId}`} className="hover:underline">
                  <div className="font-display font-black text-[13px] uppercase truncate text-black">
                    {row.fantasyTeamName}
                  </div>
                </Link>
                <div className="text-[11px] mt-0.5 text-black">
                  {row.userName ?? "Utente"}
                </div>
              </div>
              <div className="font-display font-black text-lg flex-shrink-0" style={{ color: "var(--text-secondary)" }}>
                {row.totalPoints.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
