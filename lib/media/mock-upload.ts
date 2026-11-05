import type { MockUploadPayload } from "./upload";

export const MOCK_LATENCY_MS = 900;

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_DURATION_SECONDS = 16;
const MIME_KIND = { "image/webp": "image", "image/jpeg": "image", "video/mp4": "video" } as const;

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** Controlla i metadati ricevuti dall'endpoint mock; null se non validi. */
export function parseMockUploadPayload(body: unknown): MockUploadPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const { filename, mimeType, type, size, width, height, durationSeconds, simulate } = b;
  if (typeof filename !== "string" || filename.length === 0 || filename.length > 200) return null;
  if (typeof mimeType !== "string" || !Object.hasOwn(MIME_KIND, mimeType)) return null;
  const kind = MIME_KIND[mimeType as keyof typeof MIME_KIND];
  if (type !== kind) return null;
  if (!isInt(size, 1, MAX_BYTES) || !isInt(width, 1, MAX_DIMENSION) || !isInt(height, 1, MAX_DIMENSION)) return null;
  if (simulate !== undefined && simulate !== "error") return null;
  const payload: MockUploadPayload = { filename, mimeType, size, type: kind, width, height, simulate };
  if (type === "video") {
    if (typeof durationSeconds !== "number" || !(durationSeconds > 0 && durationSeconds <= MAX_DURATION_SECONDS)) return null;
    payload.durationSeconds = durationSeconds;
  }
  return payload;
}
