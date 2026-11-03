"use client";

import { useActionState, useEffect, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { createVolleyMatch } from "@/app/actions/admin/volley";
import { calendarToVolleyDateInput } from "@/lib/volley/format";

type SelectItem = { id: number; name: string };

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

export default function NewVolleyMatchForm({
  teams,
  groups,
  rounds,
}: {
  teams: SelectItem[];
  groups: SelectItem[];
  rounds: SelectItem[];
}) {
  const [state, formAction, pending] = useActionState(createVolleyMatch, undefined);
  const [homeTeamId, setHomeTeamId] = useState<number | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [knockoutRoundId, setKnockoutRoundId] = useState<number | null>(null);
  const [date, setDate] = useState<Date | null>(() => roundedCurrentTime());
  const minDate = startOfToday();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="text-sm font-semibold" style={{ color: "var(--error, #dc2626)" }}>
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Squadra casa *</label>
        <Dropdown
          options={teams}
          optionLabel="name"
          optionValue="id"
          value={homeTeamId}
          onChange={(e) => setHomeTeamId(e.value)}
          placeholder="Seleziona"
          className="w-full"
        />
        <input type="hidden" name="homeTeamId" value={homeTeamId ?? ""} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Squadra ospite *</label>
        <Dropdown
          options={teams}
          optionLabel="name"
          optionValue="id"
          value={awayTeamId}
          onChange={(e) => setAwayTeamId(e.value)}
          placeholder="Seleziona"
          className="w-full"
        />
        <input type="hidden" name="awayTeamId" value={awayTeamId ?? ""} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Data</label>
        <Calendar
          value={date}
          onChange={(e) => setDate(e.value as Date | null)}
          showTime
          hourFormat="24"
          stepMinute={5}
          touchUI={isMobile}
          readOnlyInput={isMobile}
          minDate={minDate}
          dateFormat="dd/mm/yy"
          className="w-full"
          placeholder="Seleziona data e ora"
        />
        <input
          type="hidden"
          name="date"
          value={calendarToVolleyDateInput(date)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Girone</label>
        <Dropdown
          options={[{ id: 0, name: "Nessuno" }, ...groups]}
          optionLabel="name"
          optionValue="id"
          value={groupId ?? 0}
          onChange={(e) => setGroupId(e.value || null)}
          className="w-full"
        />
        <input type="hidden" name="groupId" value={groupId ?? ""} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Turno eliminazione</label>
        <Dropdown
          options={[{ id: 0, name: "Nessuno" }, ...rounds]}
          optionLabel="name"
          optionValue="id"
          value={knockoutRoundId ?? 0}
          onChange={(e) => setKnockoutRoundId(e.value || null)}
          className="w-full"
        />
        <input type="hidden" name="knockoutRoundId" value={knockoutRoundId ?? ""} />
      </div>

      <Button
        type="submit"
        label="Crea partita"
        loading={pending}
        style={{ background: "#0E3D2B", border: "none", color: "#fff" }}
      />
    </form>
  );
}
