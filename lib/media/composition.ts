import { clamp } from "./geometry";
import { clampMusicStart, findTrack } from "./music";
import type { MediaComposition, MediaKind, MediaOverlay } from "./types";

export const MAX_VIDEO_SECONDS = 15;
/** Durata massima del video caricato nell'editor (registrazione o galleria). */
export const MAX_SOURCE_VIDEO_SECONDS = 30;
export const MIN_VIDEO_SECONDS = 1;
export const MAX_ZOOM = 4;
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif", "heic", "heif"];
const VIDEO_EXT = ["mp4", "m4v", "mov", "webm"];

export type FileCheck = { ok: true; kind: MediaKind } | { ok: false; error: string };

/** Tipo e dimensione del file; se il browser non dà il MIME (es. HEIC su Windows) decide l'estensione. */
export function validateMediaFile(file: { name: string; type: string; size: number }): FileCheck {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const kind: MediaKind | null =
    file.type.startsWith("image/") || (!file.type && IMAGE_EXT.includes(ext))
      ? "image"
      : file.type.startsWith("video/") || (!file.type && VIDEO_EXT.includes(ext))
        ? "video"
        : null;
  if (!kind) return { ok: false, error: "Formato non supportato: scegli una foto o un video." };
  if (file.size === 0) return { ok: false, error: "Il file è vuoto." };
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) {
    return { ok: false, error: `File troppo grande: massimo ${max / 1024 / 1024} MB per ${kind === "image" ? "le foto" : "i video"}.` };
  }
  return { ok: true, kind };
}

/** Intervallo valido: dentro la sorgente, almeno MIN e al massimo MAX secondi. */
export function clampTrim(start: number, end: number, duration: number, max = MAX_VIDEO_SECONDS) {
  const min = Math.min(MIN_VIDEO_SECONDS, duration);
  const s = clamp(start, 0, Math.max(0, duration - min));
  const e = clamp(end, s + min, Math.min(duration, s + max));
  return { start: s, end: e };
}

export function clipDuration(c: MediaComposition): number {
  return c.trim ? c.trim.end - c.trim.start : 0;
}

export function createComposition(
  kind: MediaKind,
  source: MediaComposition["source"],
  opts: { flipH?: boolean } = {}
): MediaComposition {
  return normalizeComposition({
    kind,
    source,
    aspectRatio: "9:16",
    rotation: 0,
    flipH: opts.flipH ?? false,
    crop: { zoom: 1, panX: 0, panY: 0 },
    adjust: { filter: "none", brightness: 0, contrast: 0 },
    trim: kind === "video" ? { start: 0, end: source.durationSeconds ?? 0 } : null,
    coverTime: kind === "video" ? 0 : null,
    overlays: [],
    music: null,
  });
}

const normalizeOverlay = (o: MediaOverlay): MediaOverlay => ({
  ...o,
  x: clamp(o.x, 0, 1),
  y: clamp(o.y, 0, 1),
  size: clamp(o.size, 0.02, 2),
  rotation: Math.atan2(Math.sin(o.rotation), Math.cos(o.rotation)),
});

/** Riporta ogni valore nel suo intervallo valido; i campi solo-video spariscono dalle foto. */
export function normalizeComposition(c: MediaComposition): MediaComposition {
  const duration = c.source.durationSeconds ?? 0;
  const trim = c.kind === "video" && c.trim ? clampTrim(c.trim.start, c.trim.end, duration) : null;
  const clip = trim ? trim.end - trim.start : 0;
  const track = c.kind === "video" && c.music ? findTrack(c.music.trackId) : undefined;
  return {
    ...c,
    crop: {
      zoom: clamp(c.crop.zoom, 1, MAX_ZOOM),
      panX: clamp(c.crop.panX, -1, 1),
      panY: clamp(c.crop.panY, -1, 1),
    },
    adjust:
      c.kind === "image"
        ? { ...c.adjust, brightness: clamp(c.adjust.brightness, -1, 1), contrast: clamp(c.adjust.contrast, -1, 1) }
        : { filter: "none", brightness: 0, contrast: 0 },
    trim,
    coverTime: trim ? clamp(c.coverTime ?? trim.start, trim.start, trim.end) : null,
    overlays: c.overlays.map(normalizeOverlay),
    music:
      track && c.music
        ? { trackId: track.id, startTimeSeconds: clampMusicStart(c.music.startTimeSeconds, track.durationSeconds, clip) }
        : null,
  };
}

// Annulla/ripristina: i gesti continui aggiornano solo present (commit false) e salvano
// il punto di ritorno una volta sola all'inizio con "checkpoint".
export interface History {
  past: MediaComposition[];
  present: MediaComposition;
  future: MediaComposition[];
}

export type HistoryAction =
  | { type: "set"; composition: MediaComposition; commit: boolean }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" };

const HISTORY_LIMIT = 50;

export function historyReducer(h: History, a: HistoryAction): History {
  switch (a.type) {
    case "set": {
      const present = normalizeComposition(a.composition);
      return a.commit
        ? { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present, future: [] }
        : { ...h, present };
    }
    case "checkpoint":
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: h.present, future: [] };
    case "undo":
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    case "redo":
      if (!h.future.length) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
  }
}
