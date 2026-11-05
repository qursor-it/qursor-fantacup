/** m:ss */
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const decimal = (v: number) => v.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatSeconds = (seconds: number) => `${decimal(seconds)} s`;

export const formatMB = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${decimal(bytes / 1024 / 1024)} MB`;
