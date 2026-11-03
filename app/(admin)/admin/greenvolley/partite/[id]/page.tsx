import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import AdminPageHeader from "@/components/admin-page-header";
import SetSection from "./_sets-section";
import EditVolleyMatchForm from "./_match-form";
import { requireAdmin } from "@/lib/session";
import { parseId } from "@/lib/parse-id";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bozza",
  SCHEDULED: "Programmata",
  CONCLUDED: "Conclusa",
};
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  DRAFT:     { bg: "rgba(0,0,0,0.08)",           color: "var(--text-muted)" },
  SCHEDULED: { bg: "rgba(14,61,43,0.15)",        color: "#0E3D2B" },
  CONCLUDED: { bg: "rgba(61,217,7,0.25)",        color: "#166534" },
};

export default async function VolleyMatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const matchId = parseId(id);
  if (matchId === null) notFound();
  const [match, teams, groups, rounds] = await Promise.all([
    db.volleyMatch.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
        sets: { orderBy: { setNumber: "asc" } },
        group: { select: { id: true, name: true } },
        knockoutRound: { select: { id: true, name: true } },
      },
    }),
    db.volleyTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.volleyGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.volleyKnockoutRound.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!match) notFound();

  const homeSets = match.sets.filter((s) => s.homePoints > s.awayPoints).length;
  const awaySets = match.sets.filter((s) => s.awayPoints > s.homePoints).length;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <AdminPageHeader accentColor="#0E3D2B"
        title="Gestione partita"
        backHref="/admin/greenvolley/partite"
      />

      {/* Hero */}
      <div
        className="rounded-[1.25rem] p-4 sm:rounded-2xl sm:p-5"
        style={{ background: "linear-gradient(135deg, #1a3a1a 0%, #0d1f0d 100%)" }}
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            {(() => {
              const s = STATUS_STYLE[match.status] ?? STATUS_STYLE.DRAFT;
              return (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-black sm:text-[10px]"
                  style={{ background: s.bg, color: s.color }}
                >
                  {STATUS_LABEL[match.status] ?? match.status}
                </span>
              );
            })()}
            {match.group && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-black sm:text-[10px]"
                style={{ background: "rgba(14,61,43,0.20)", color: "#0E3D2B" }}
              >
                {match.group.name}
              </span>
            )}
            {match.knockoutRound && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-black sm:text-[10px]"
                style={{ background: "rgba(14,61,43,0.20)", color: "#0E3D2B" }}
              >
                {match.knockoutRound.name}
              </span>
            )}
          </div>
          {match.date && (
            <span className="text-[11px] text-white/55 sm:text-xs">
              {match.date.toLocaleDateString("it-IT", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
          <span className="min-w-0 break-words text-right text-base font-black leading-tight text-white sm:text-xl">
            {match.homeTeam.name}
          </span>
          <div className="min-w-[64px] text-center sm:min-w-[90px]">
            <div className="whitespace-nowrap text-3xl font-black leading-none sm:text-4xl" style={{ color: "#0E3D2B" }}>
              {match.sets.length > 0 ? `${homeSets} - ${awaySets}` : "vs"}
            </div>
            {match.sets.length > 0 && (
              <div className="mt-1 text-[11px] text-white/55 sm:text-xs">set vinti</div>
            )}
          </div>
          <span className="min-w-0 break-words text-base font-black leading-tight text-white sm:text-xl">
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      <div className="admin-card p-4 sm:p-5">
        <div className="over-label mb-4">Dati partita</div>
        <EditVolleyMatchForm
          match={{
            id: match.id,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
            date: match.date ? match.date.toISOString() : null,
            groupId: match.groupId,
            knockoutRoundId: match.knockoutRoundId,
            homeDisciplinaryPoints: match.homeDisciplinaryPoints,
            awayDisciplinaryPoints: match.awayDisciplinaryPoints,
          }}
          teams={teams}
          groups={groups}
          rounds={rounds}
        />
      </div>

      {/* Sezione set */}
      <SetSection
        match={{
          id: match.id,
          status: match.status,
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          sets: match.sets,
        }}
      />
    </div>
  );
}
