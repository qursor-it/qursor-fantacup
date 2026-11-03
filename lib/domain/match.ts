export const LIVE_MATCH_WINDOW_MS = 120 * 60 * 1000;
export const MATCH_TIME_ZONE = "Europe/Rome";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatMatchDateInputValue(startsAt: Date) {
  return `${startsAt.getUTCFullYear()}-${pad2(startsAt.getUTCMonth() + 1)}-${pad2(startsAt.getUTCDate())}`;
}

export function formatMatchTimeInputValue(startsAt: Date) {
  return `${pad2(startsAt.getUTCHours())}:${pad2(startsAt.getUTCMinutes())}`;
}

export function parseMatchDateTimeInput(date: string, time: string) {
  return new Date(`${date}T${time}:00.000Z`);
}

export function resolveMatchScore(
  submitted: { homeScore?: number | null; awayScore?: number | null },
  stored: { homeScore: number | null; awayScore: number | null }
) {
  return {
    homeScore: submitted.homeScore !== undefined ? submitted.homeScore : stored.homeScore,
    awayScore: submitted.awayScore !== undefined ? submitted.awayScore : stored.awayScore,
  };
}

export function getMatchClockNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MATCH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(
    Number(valueByType.get("year")),
    Number(valueByType.get("month")) - 1,
    Number(valueByType.get("day")),
    Number(valueByType.get("hour")),
    Number(valueByType.get("minute")),
    Number(valueByType.get("second"))
  ));
}

export function isScheduledMatchInProgress({
  status,
  startsAt,
  now = getMatchClockNow(),
  windowMs = LIVE_MATCH_WINDOW_MS,
}: {
  status: string;
  startsAt: Date;
  now?: Date;
  windowMs?: number;
}) {
  const elapsedMs = now.getTime() - startsAt.getTime();
  return status === "SCHEDULED" && elapsedMs >= 0 && elapsedMs <= windowMs;
}
