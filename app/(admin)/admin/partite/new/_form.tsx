"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useMediaQuery } from "@/components/use-media-query";
import Link from "next/link";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { createMatch } from "@/app/actions/admin/matches";

type Team = { id: number; name: string };
type Group = { id: number; name: string; slug: string };

const STATUS_OPTIONS = [
  { label: "Bozza",       value: "DRAFT"      },
  { label: "Programmata", value: "SCHEDULED"  },
];

const PHASE_OPTIONS = [
  { label: "Nessuna (amichevole)", value: "" },
  { label: "Girone", value: "group" },
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function roundedCurrentTime() {
  const date = new Date();
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  return date;
}

export default function NuovaPartitaForm({
  teams,
  groups,
  defaultGroupId,
}: {
  teams: Team[];
  groups: Group[];
  defaultGroupId: number | null;
}) {
  const [state, action, pending] = useActionState(createMatch, undefined);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [homeTeamId, setHomeTeamId] = useState<string>("");
  const [awayTeamId, setAwayTeamId] = useState<string>("");
  const [status, setStatus]         = useState<string>("DRAFT");
  const [date, setDate]             = useState<Date | null>(() => startOfToday());
  const [time, setTime]             = useState<Date | null>(() => roundedCurrentTime());
  const [phase, setPhase] = useState<string>(defaultGroupId ? "group" : "");
  const [groupId, setGroupId] = useState<string>(defaultGroupId ? String(defaultGroupId) : "");


  const allTeamOptions = teams.map((t) => ({ label: t.name, value: String(t.id) }));
  const homeOptions    = allTeamOptions.filter((t) => t.value !== awayTeamId);
  const awayOptions    = allTeamOptions.filter((t) => t.value !== homeTeamId);
  const minDate = startOfToday();

  const formattedDate = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
  const formattedTime = time
    ? `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`
    : "";

  const groupOptions = groups.map((g) => ({ label: `Girone ${g.slug} — ${g.name}`, value: String(g.id) }));

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="groupId" value={phase === "group" ? groupId : ""} />

      {/* Fase */}
      <div className="max-w-xs">
        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Fase del torneo
        </label>
        <Dropdown
          value={phase}
          onChange={(e) => { setPhase(e.value); setGroupId(""); }}
          options={PHASE_OPTIONS}
          className="w-full"
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
          Le partite di eliminazione diretta si gestiscono da{" "}
          <Link href="/admin/eliminazione" className="font-semibold underline underline-offset-2" style={{ color: "var(--primary)" }}>
            Eliminazione diretta
          </Link>.
        </p>
      </div>

      {phase === "group" && (
        <div className="max-w-xs">
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Girone *
          </label>
          <Dropdown value={groupId} onChange={(e) => setGroupId(e.value)} options={groupOptions} className="w-full" placeholder="Seleziona girone" />
        </div>
      )}

      {/* Squadre */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Squadra casa *
          </label>
          <input type="hidden" name="homeTeamId" value={homeTeamId} />
          <Dropdown
            value={homeTeamId}
            onChange={(e) => setHomeTeamId(e.value)}
            options={homeOptions}
            placeholder="Seleziona squadra"
            className="w-full"
            filter
          />
          {state?.errors?.homeTeamId && (
            <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.homeTeamId[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Squadra ospite *
          </label>
          <input type="hidden" name="awayTeamId" value={awayTeamId} />
          <Dropdown
            value={awayTeamId}
            onChange={(e) => setAwayTeamId(e.value)}
            options={awayOptions}
            placeholder="Seleziona squadra"
            className="w-full"
            filter
          />
          {state?.errors?.awayTeamId && (
            <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.awayTeamId[0]}</p>
          )}
        </div>
      </div>

      {/* Stato */}
      <div className="max-w-xs">
        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Stato
        </label>
        <input type="hidden" name="status" value={status} />
        <Dropdown
          value={status}
          onChange={(e) => setStatus(e.value)}
          options={STATUS_OPTIONS}
          className="w-full"
        />
      </div>

      {/* Data e ora */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Data *
          </label>
          <input type="hidden" name="date" value={formattedDate} />
          <Calendar
            value={date}
            onChange={(e) => setDate(e.value as Date | null)}
            dateFormat="dd/mm/yy"
            minDate={minDate}
            showIcon
            className="w-full"
            inputClassName="w-full"
            showButtonBar
          />
          {state?.errors?.date && (
            <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.date[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Ora *
          </label>
          <input type="hidden" name="time" value={formattedTime} />
          <Calendar
            value={time}
            onChange={(e) => setTime(e.value as Date | null)}
            timeOnly
            showIcon
            className="w-full"
            inputClassName="w-full"
            hourFormat="24"
            stepMinute={5}
            touchUI={isMobile}
            readOnlyInput={isMobile}
          />
          {state?.errors?.time && (
            <p className="text-xs mt-1" style={{ color: "#991B1B" }}>{state.errors.time[0]}</p>
          )}
        </div>
      </div>

      {state?.message && (
        <p className="text-xs" style={{ color: "#991B1B" }}>{state.message}</p>
      )}

      <div>
        <Button type="submit" label={pending ? "Salvo..." : "Crea partita"} disabled={pending} icon="pi pi-check" />
      </div>
    </form>
  );
}
