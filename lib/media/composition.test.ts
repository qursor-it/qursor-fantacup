import { describe, expect, it } from "vitest";
import {
  clampTrim,
  createComposition,
  historyReducer,
  normalizeComposition,
  validateMediaFile,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  type History,
} from "./composition";
import { MUSIC_CATALOG } from "./music";
import type { MediaComposition, StickerOverlay } from "./types";

const video = (over: Partial<MediaComposition> = {}): MediaComposition => ({
  ...createComposition("video", { width: 1920, height: 1080, durationSeconds: 30 }),
  ...over,
});
const sticker = (over: Partial<StickerOverlay> = {}): StickerOverlay => ({
  id: "s", type: "sticker", stickerId: "gol", x: 0.5, y: 0.5, size: 0.3, rotation: 0, ...over,
});

describe("validateMediaFile", () => {
  it("accetta foto comuni", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateMediaFile({ name: "a", type, size: 10 })).toEqual({ ok: true, kind: "image" });
    }
  });

  it("riconosce HEIC senza MIME dall'estensione", () => {
    expect(validateMediaFile({ name: "IMG.HEIC", type: "", size: 10 })).toEqual({ ok: true, kind: "image" });
  });

  it("riconosce mov e webm come video", () => {
    expect(validateMediaFile({ name: "a.mov", type: "", size: 10 })).toEqual({ ok: true, kind: "video" });
    expect(validateMediaFile({ name: "a.webm", type: "video/webm", size: 10 })).toEqual({ ok: true, kind: "video" });
  });

  it("rifiuta tipi sconosciuti, file vuoti e troppo grandi", () => {
    expect(validateMediaFile({ name: "a.pdf", type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(validateMediaFile({ name: "a.xyz", type: "", size: 10 }).ok).toBe(false);
    expect(validateMediaFile({ name: "a.jpg", type: "image/jpeg", size: 0 }).ok).toBe(false);
    expect(validateMediaFile({ name: "a.jpg", type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }).ok).toBe(false);
    expect(validateMediaFile({ name: "a.mp4", type: "video/mp4", size: MAX_VIDEO_BYTES + 1 }).ok).toBe(false);
    expect(validateMediaFile({ name: "a.mp4", type: "video/mp4", size: MAX_IMAGE_BYTES + 1 }).ok).toBe(true);
  });
});

describe("clampTrim", () => {
  it("tiene l'intervallo dentro la durata", () => {
    expect(clampTrim(-5, 100, 30)).toEqual({ start: 0, end: 30 });
  });

  it("garantisce almeno 1 secondo", () => {
    expect(clampTrim(10, 10.2, 30)).toEqual({ start: 10, end: 11 });
    expect(clampTrim(30, 30, 30)).toEqual({ start: 29, end: 30 });
  });

  it("limita la finestra a 60 secondi", () => {
    expect(clampTrim(10, 200, 300)).toEqual({ start: 10, end: 70 });
  });

  it("gestisce video piu corti di 1 secondo", () => {
    expect(clampTrim(0, 0.5, 0.5)).toEqual({ start: 0, end: 0.5 });
  });
});

describe("createComposition", () => {
  it("per i video trim e [0, min(durata, 60)]", () => {
    expect(video().trim).toEqual({ start: 0, end: 30 });
    const long = createComposition("video", { width: 100, height: 100, durationSeconds: 200 });
    expect(long.trim).toEqual({ start: 0, end: 60 });
    expect(long.coverTime).toBe(0);
  });

  it("le foto non hanno trim, copertina ne musica", () => {
    const img = createComposition("image", { width: 100, height: 100 });
    expect(img.trim).toBeNull();
    expect(img.coverTime).toBeNull();
    expect(img.music).toBeNull();
  });
});

describe("normalizeComposition", () => {
  it("riporta zoom e pan negli intervalli", () => {
    const c = normalizeComposition({ ...video(), crop: { zoom: 10, panX: 5, panY: -5 } });
    expect(c.crop).toEqual({ zoom: 4, panX: 1, panY: -1 });
    expect(normalizeComposition({ ...video(), crop: { zoom: 0.2, panX: 0, panY: 0 } }).crop.zoom).toBe(1);
  });

  it("limita gli overlay e riporta la rotazione in (-pi, pi]", () => {
    const o = normalizeComposition({
      ...video(),
      overlays: [sticker({ x: -1, y: 2, size: 9, rotation: 3 * Math.PI })],
    }).overlays[0];
    expect(o.x).toBe(0);
    expect(o.y).toBe(1);
    expect(o.size).toBe(2);
    expect(Math.abs(o.rotation)).toBeCloseTo(Math.PI);
    const small = normalizeComposition({ ...video(), overlays: [sticker({ size: 0, rotation: 2.5 * Math.PI })] }).overlays[0];
    expect(small.size).toBe(0.02);
    expect(small.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("azzera le regolazioni sui video e le limita sulle foto", () => {
    const adjust = { filter: "bw", brightness: 5, contrast: -5 } as const;
    expect(normalizeComposition({ ...video(), adjust }).adjust).toEqual({ filter: "none", brightness: 0, contrast: 0 });
    const img = createComposition("image", { width: 100, height: 100 });
    expect(normalizeComposition({ ...img, adjust }).adjust).toEqual({ filter: "bw", brightness: 1, contrast: -1 });
  });

  it("tiene coverTime dentro il trim", () => {
    expect(normalizeComposition({ ...video(), trim: { start: 5, end: 15 }, coverTime: 25 }).coverTime).toBe(15);
    expect(normalizeComposition({ ...video(), trim: { start: 5, end: 15 }, coverTime: 1 }).coverTime).toBe(5);
  });

  it("limita l'inizio della musica cosi il brano copre la clip", () => {
    const short = MUSIC_CATALOG.find((m) => m.durationSeconds === 20)!;
    const c = normalizeComposition({ ...video(), music: { trackId: short.id, startTimeSeconds: 99 } });
    expect(c.music).toEqual({ trackId: short.id, startTimeSeconds: 0 });
    const long = MUSIC_CATALOG[0];
    const c2 = normalizeComposition({ ...video(), music: { trackId: long.id, startTimeSeconds: 999 } });
    expect(c2.music?.startTimeSeconds).toBe(long.durationSeconds - 30);
  });

  it("rimuove brani sconosciuti e la musica dalle foto", () => {
    expect(normalizeComposition({ ...video(), music: { trackId: "nope", startTimeSeconds: 0 } }).music).toBeNull();
    const img = createComposition("image", { width: 100, height: 100 });
    const withMusic = { ...img, music: { trackId: MUSIC_CATALOG[0].id, startTimeSeconds: 0 } };
    expect(normalizeComposition(withMusic).music).toBeNull();
  });
});

describe("historyReducer", () => {
  const a = video();
  const withZoom = (z: number) => ({ ...a, crop: { zoom: z, panX: 0, panY: 0 } });
  const start: History = { past: [], present: a, future: [] };

  it("set con commit salva il punto di ritorno", () => {
    const h = historyReducer(start, { type: "set", composition: withZoom(2), commit: true });
    expect(h.past).toEqual([a]);
    expect(h.present.crop.zoom).toBe(2);
  });

  it("set senza commit aggiorna solo present", () => {
    const h = historyReducer(start, { type: "set", composition: withZoom(2), commit: false });
    expect(h.past).toEqual([]);
    expect(h.present.crop.zoom).toBe(2);
  });

  it("checkpoint salva present senza cambiarlo", () => {
    const h = historyReducer(start, { type: "checkpoint" });
    expect(h.past).toEqual([a]);
    expect(h.present).toBe(a);
  });

  it("undo e redo ripercorrono la cronologia", () => {
    const h1 = historyReducer(start, { type: "set", composition: withZoom(2), commit: true });
    const h2 = historyReducer(h1, { type: "undo" });
    expect(h2.present).toBe(a);
    expect(h2.future).toHaveLength(1);
    expect(historyReducer(h2, { type: "redo" }).present.crop.zoom).toBe(2);
    expect(historyReducer(start, { type: "undo" })).toBe(start);
    expect(historyReducer(start, { type: "redo" })).toBe(start);
  });

  it("un nuovo commit svuota il futuro", () => {
    const h1 = historyReducer(start, { type: "set", composition: withZoom(2), commit: true });
    const h2 = historyReducer(h1, { type: "undo" });
    expect(historyReducer(h2, { type: "set", composition: withZoom(3), commit: true }).future).toEqual([]);
  });

  it("conserva al massimo 50 passi", () => {
    let h = start;
    for (let i = 0; i < 60; i++) h = historyReducer(h, { type: "checkpoint" });
    expect(h.past).toHaveLength(50);
  });
});
