"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { deleteMatch } from "@/app/actions/admin/matches";
import ConfirmDeleteForm from "@/components/confirm-delete-form";
import StatusBadge from "@/components/status-badge";

type Row = {
  id: number;
  status: string;
  startsAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: { name: string; shortName: string | null } | null;
  awayTeam: { name: string; shortName: string | null } | null;
  homeSeed: string | null;
  awaySeed: string | null;
  groupId: number | null;
  knockoutRoundId: number | null;
  group: { slug: string } | null;
  knockoutRound: { name: string } | null;
  _count: { players: number };
};

type Tab = "all" | "group" | "knockout" | "none";

const PAGE_SIZE = 15;

export default function PartiteTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(0);

  const filtered = rows.filter((r) => {
    if (tab === "all") return true;
    if (tab === "group") return r.groupId !== null;
    if (tab === "knockout") return r.knockoutRoundId !== null;
    if (tab === "none") return r.groupId === null && r.knockoutRoundId === null;
    return true;
  });

  const total = filtered.length;
  const start = page * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const counts = {
    all: rows.length,
    group: rows.filter((r) => r.groupId !== null).length,
    knockout: rows.filter((r) => r.knockoutRoundId !== null).length,
    none: rows.filter((r) => r.groupId === null && r.knockoutRoundId === null).length,
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "all",      label: `Tutte (${counts.all})` },
    { key: "group",    label: `Gironi (${counts.group})` },
    { key: "knockout", label: `Eliminazione (${counts.knockout})` },
    { key: "none",     label: `Senza fase (${counts.none})` },
  ];

  const changeTab = (t: Tab) => { setTab(t); setPage(0); };

  return (
    <div className="card overflow-hidden">
      {/* Tabs */}
      <div
        className="flex items-center gap-0.5 px-3 py-2 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--surface-1)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => changeTab(t.key)}
            className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
            style={
              tab === t.key
                ? { background: "var(--primary)", color: "#fff" }
                : { color: "var(--text-muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {total === 0 ? (
        <p className="px-4 py-10 text-center over-label">Nessuna partita.</p>
      ) : (
        <>
          {slice.map((row, idx) => {
            const isAnomaly = row.status === "CONCLUDED" && row._count.players === 0;
            const href = `/admin/partite/${row.id}`;
            return (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--surface-1)] transition-colors cursor-pointer"
                style={idx < slice.length - 1 ? { borderBottom: "1px solid var(--border-soft)" } : {}}
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                onClick={() => router.push(href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <StatusBadge status={row.status} />
                    {row.group && (
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: "var(--primary-light)", color: "var(--primary)" }}
                      >
                        Girone {row.group.slug}
                      </span>
                    )}
                    {row.knockoutRound && (
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(232,160,0,0.10)", color: "#C48A00" }}
                      >
                        {row.knockoutRound.name}
                      </span>
                    )}
                    {isAnomaly && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(234,179,8,0.12)", color: "#854d0e", border: "1px solid rgba(234,179,8,0.3)" }}
                      >
                        ⚠ no giocatori
                      </span>
                    )}
                  </div>
                  <div className="font-display font-black text-sm uppercase flex items-baseline gap-1.5 flex-wrap" style={{ color: "var(--text-primary)" }}>
                    <span>{row.homeTeam?.shortName ?? row.homeTeam?.name ?? row.homeSeed ?? "TBD"}</span>
                    <span className="font-sans font-bold text-xs" style={{ color: row.homeScore !== null && row.awayScore !== null ? "var(--primary)" : "var(--text-disabled)" }}>
                      {row.homeScore !== null && row.awayScore !== null ? `${row.homeScore}—${row.awayScore}` : "vs"}
                    </span>
                    <span>{row.awayTeam?.shortName ?? row.awayTeam?.name ?? row.awaySeed ?? "TBD"}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {new Date(row.startsAt).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    {" · "}{row._count.players} giocatori
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <ConfirmDeleteForm
                    action={deleteMatch}
                    hiddenInputs={{ id: row.id }}
                    confirmMessage="Eliminare la partita? L'operazione è irreversibile."
                  />
                </div>
                <i className="pi pi-chevron-right text-xs flex-shrink-0" style={{ color: "var(--text-disabled)" }} />
              </div>
            );
          })}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderTop: "1px solid var(--border-soft)", background: "var(--surface-1)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {start + 1}–{Math.min(start + PAGE_SIZE, total)} di {total}
              </span>
              <div className="flex gap-1">
                <Button icon="pi pi-chevron-left" text size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Precedente" />
                <Button icon="pi pi-chevron-right" text size="small" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Successiva" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
