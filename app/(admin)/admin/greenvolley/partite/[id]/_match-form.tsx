"use client";

import { useActionState, useState } from "react";
import { useMediaQuery } from "@/components/use-media-query";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { updateVolleyMatch } from "@/app/actions/admin/volley";
import { calendarToVolleyDateInput, storedVolleyDateToCalendar } from "@/lib/volley/format";

type SelectItem = { id: number; name: string };

type MatchFormValue = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  date: string | null;
  groupId: number | null;
  knockoutRoundId: number | null;
  homeDisciplinaryPoints: number;
  awayDisciplinaryPoints: number;
};

export default function EditVolleyMatchForm({
  match,
  teams,
  groups,
  rounds,
}: {
  match: MatchFormValue;
  teams: SelectItem[];
  groups: SelectItem[];
  rounds: SelectItem[];
}) {
  const action = updateVolleyMatch.bind(null, match.id);
  const [state, formAction, pending] = useActionState(action, undefined);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [homeTeamId, setHomeTeamId] = useState<number | null>(match.homeTeamId);
  const [awayTeamId, setAwayTeamId] = useState<number | null>(match.awayTeamId);
  const [groupId, setGroupId] = useState<number | null>(match.groupId);
  const [knockoutRoundId, setKnockoutRoundId] = useState<number | null>(match.knockoutRoundId);
  const [homeDisciplinaryPoints, setHomeDisciplinaryPoints] = useState<number | null>(
    match.homeDisciplinaryPoints
  );
  const [awayDisciplinaryPoints, setAwayDisciplinaryPoints] = useState<number | null>(
    match.awayDisciplinaryPoints
  );
  const [date, setDate] = useState<Date | null>(() => storedVolleyDateToCalendar(match.date));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="text-sm font-semibold" style={{ color: "var(--error, #dc2626)" }}>
          {state.error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold">Squadra casa *</label>
          <Dropdown
            options={teams}
            optionLabel="name"
            optionValue="id"
            value={homeTeamId}
            onChange={(event) => setHomeTeamId(event.value)}
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
            onChange={(event) => setAwayTeamId(event.value)}
            placeholder="Seleziona"
            className="w-full"
          />
          <input type="hidden" name="awayTeamId" value={awayTeamId ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold">Data</label>
        <Calendar
          value={date}
          onChange={(event) => setDate(event.value as Date | null)}
          showTime
          hourFormat="24"
          stepMinute={5}
          touchUI={isMobile}
          readOnlyInput={isMobile}
          dateFormat="dd/mm/yy"
          className="w-full"
          placeholder="Seleziona data e ora"
        />
        <input type="hidden" name="date" value={calendarToVolleyDateInput(date)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold">Girone</label>
          <Dropdown
            options={[{ id: 0, name: "Nessuno" }, ...groups]}
            optionLabel="name"
            optionValue="id"
            value={groupId ?? 0}
            onChange={(event) => setGroupId(event.value || null)}
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
            onChange={(event) => setKnockoutRoundId(event.value || null)}
            className="w-full"
          />
          <input type="hidden" name="knockoutRoundId" value={knockoutRoundId ?? ""} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div>
          <label className="text-sm font-semibold">Punteggio disciplinare</label>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Rosso da somma ammonizioni = 1, rosso diretto = 2.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">Casa</label>
            <InputNumber
              value={homeDisciplinaryPoints}
              onValueChange={(event) => setHomeDisciplinaryPoints(event.value ?? null)}
              min={0}
              max={99}
              className="w-full"
            />
            <input type="hidden" name="homeDisciplinaryPoints" value={homeDisciplinaryPoints ?? ""} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">Ospite</label>
            <InputNumber
              value={awayDisciplinaryPoints}
              onValueChange={(event) => setAwayDisciplinaryPoints(event.value ?? null)}
              min={0}
              max={99}
              className="w-full"
            />
            <input type="hidden" name="awayDisciplinaryPoints" value={awayDisciplinaryPoints ?? ""} />
          </div>
        </div>
      </div>

      <Button
        type="submit"
        label="Salva dati partita"
        loading={pending}
        className="w-full md:w-auto md:self-start"
        style={{ background: "#0E3D2B", border: "none", color: "#fff" }}
      />
    </form>
  );
}
