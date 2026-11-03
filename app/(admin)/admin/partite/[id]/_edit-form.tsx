"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useMediaQuery } from "@/components/use-media-query";
import Link from "next/link";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { updateMatch } from "@/app/actions/admin/matches";
import { formatMatchDateInputValue, formatMatchTimeInputValue } from "@/lib/domain/match";

type Team = { id: number; name: string };
type Group = { id: number; name: string; slug: string };
type Round = { id: number; name: string };
type Match = {
  id: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  groupId: number | null;
  knockoutRoundId: number | null;
  startsAt: Date;
  status: string;
};

const STATUS_OPTIONS = [
  { label: "Bozza",       value: "DRAFT"     },
  { label: "Programmata", value: "SCHEDULED" },
  { label: "Conclusa",    value: "CONCLUDED" },
];

const PHASE_OPTIONS = [
  { label: "Nessuna (amichevole)", value: "" },
  { label: "Girone",               value: "group" },
  { label: "Eliminazione diretta", value: "knockout" },
];

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function safeInitialStartsAt(startsAt: Date) {
  return startsAt.getTime() <= 0 ? startOfToday() : startsAt;
}

function dateInputToLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function timeInputToLocalDate(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export default function EditMatchForm({
  match,
  teams,
  groups,
  rounds,
}: {
  match: Match;
  teams: Team[];
  groups: Group[];
  rounds: Round[];
}) {
  const [state, action, pending] = useActionState(updateMatch, undefined);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const initialStartsAt = safeInitialStartsAt(match.startsAt);
  const defaultDate = formatMatchDateInputValue(initialStartsAt);
  const defaultTime = formatMatchTimeInputValue(initialStartsAt);

  const [homeTeamId, setHomeTeamId] = useState<string>(match.homeTeamId ? String(match.homeTeamId) : "");
  const [awayTeamId, setAwayTeamId] = useState<string>(match.awayTeamId ? String(match.awayTeamId) : "");
  const [status, setStatus] = useState<string>(match.status);
  const [date, setDate] = useState<Date | null>(() => {
    const d = dateInputToLocalDate(defaultDate);
    return isNaN(d.getTime()) ? null : d;
  });
  const [time, setTime] = useState<Date | null>(() => timeInputToLocalDate(defaultTime));
  const [phase, setPhase] = useState<string>(
    match.groupId ? "group" : match.knockoutRoundId ? "knockout" : ""
  );
  const [groupId, setGroupId] = useState<string>(match.groupId ? String(match.groupId) : "");
  const [knockoutRoundId, setKnockoutRoundId] = useState<string>(
    match.knockoutRoundId ? String(match.knockoutRoundId) : ""
  );


  const teamOptions = teams.map((t) => ({ label: t.name, value: String(t.id) }));
  const groupOptions = groups.map((g) => ({ label: `Girone ${g.slug} — ${g.name}`, value: String(g.id) }));
  const roundOptions = rounds.map((r) => ({ label: r.name, value: String(r.id) }));
  const hasKnockoutRounds = roundOptions.length > 0;

  const formattedDate = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
  const formattedTime = time
    ? `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <form action={action} className="flex flex-col gap-4 pt-3">
      <input type="hidden" name="id" value={match.id} />
      <input type="hidden" name="groupId" value={phase === "group" ? groupId : ""} />
      <input type="hidden" name="knockoutRoundId" value={phase === "knockout" ? knockoutRoundId : ""} />

      {/* Fase */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
          Fase del torneo
        </label>
        <Dropdown
          value={phase}
          onChange={(e) => { setPhase(e.value); setGroupId(""); setKnockoutRoundId(""); }}
          options={PHASE_OPTIONS}
          className="w-full"
        />
      </div>

      {phase === "group" && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Girone
          </label>
          <Dropdown value={groupId} onChange={(e) => setGroupId(e.value)} options={groupOptions} className="w-full" placeholder="Seleziona girone" />
        </div>
      )}

      {phase === "knockout" && (
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Turno eliminazione
          </label>
          <Dropdown
            value={knockoutRoundId}
            onChange={(e) => setKnockoutRoundId(e.value)}
            options={roundOptions}
            className="w-full"
            placeholder={hasKnockoutRounds ? "Seleziona turno" : "Nessun turno disponibile"}
            disabled={!hasKnockoutRounds}
          />
          {!hasKnockoutRounds && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              Nessun turno configurato. Vai in{" "}
              <Link href="/admin/eliminazione" className="font-semibold underline underline-offset-2" style={{ color: "var(--primary)" }}>
                Eliminazione diretta
              </Link>{" "}
              per inizializzare il bracket.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Squadra casa
          </label>
          <input type="hidden" name="homeTeamId" value={homeTeamId} />
          <Dropdown value={homeTeamId} onChange={(e) => setHomeTeamId(e.value)} options={teamOptions} className="w-full" filter />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Squadra ospite
          </label>
          <input type="hidden" name="awayTeamId" value={awayTeamId} />
          <Dropdown value={awayTeamId} onChange={(e) => setAwayTeamId(e.value)} options={teamOptions} className="w-full" filter />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Data
          </label>
          <input type="hidden" name="date" value={formattedDate} />
          <Calendar value={date} onChange={(e) => setDate(e.value as Date | null)} dateFormat="dd/mm/yy" showIcon className="w-full" inputClassName="w-full" showButtonBar />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Ora
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
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            Stato
          </label>
          <input type="hidden" name="status" value={status} />
          <Dropdown value={status} onChange={(e) => setStatus(e.value)} options={STATUS_OPTIONS} className="w-full" />
        </div>
      </div>

      {state?.errors?.awayTeamId && (
        <p className="text-xs" style={{ color: "#991B1B" }}>{state.errors.awayTeamId[0]}</p>
      )}
      {state?.message && (
        <p className="text-xs" style={{ color: "#991B1B" }}>{state.message}</p>
      )}

      <Button type="submit" label={pending ? "Salvo..." : "Salva modifiche"} disabled={pending} icon="pi pi-check" className="w-full sm:w-auto" />
    </form>
  );
}
