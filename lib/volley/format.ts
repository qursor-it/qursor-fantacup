export function formatVolleyMatchTime(date: Date): string {
  return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function formatVolleyDayPill(date: Date): string {
  return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatVolleyDayHeading(date: Date): string {
  return date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export function formatVolleyDate(date: Date): string {
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Le date volley sono salvate come orario "da muro" di Roma in UTC (vedi
 * `parseVolleyMatchDate`). Per il Calendar (che lavora in ora locale del browser)
 * si convertono i componenti UTC in una Date locale e viceversa.
 */
export function storedVolleyDateToCalendar(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

export function calendarToVolleyDateInput(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
