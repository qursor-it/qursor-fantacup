import type { AspectRatio, MediaComposition, QuarterTurn } from "./types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ASPECT_RATIOS: { id: AspectRatio; label: string }[] = [
  { id: "original", label: "Originale" },
  { id: "1:1", label: "1:1" },
  { id: "4:5", label: "4:5" },
  { id: "9:16", label: "9:16" },
];

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function rotatedSize(width: number, height: number, rotation: QuarterTurn) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/** Rapporto larghezza/altezza dell'output; "original" segue la sorgente già ruotata. */
export function aspectValue(ratio: AspectRatio, srcWidth: number, srcHeight: number): number {
  switch (ratio) {
    case "1:1":
      return 1;
    case "4:5":
      return 4 / 5;
    case "9:16":
      return 9 / 16;
    case "original":
      return srcWidth / srcHeight;
  }
}

/** Porzione della sorgente (ruotata e specchiata) che finisce nell'output, in pixel della sorgente. */
export function cropRect(c: Pick<MediaComposition, "source" | "rotation" | "aspectRatio" | "crop">): Rect {
  const { width: sw, height: sh } = rotatedSize(c.source.width, c.source.height, c.rotation);
  const ratio = aspectValue(c.aspectRatio, sw, sh);
  const zoom = Math.max(1, c.crop.zoom);
  let w = sw / sh > ratio ? sh * ratio : sw;
  let h = w / ratio;
  w /= zoom;
  h /= zoom;
  const x = (sw - w) / 2 + (clamp(c.crop.panX, -1, 1) * (sw - w)) / 2;
  const y = (sh - h) / 2 + (clamp(c.crop.panY, -1, 1) * (sh - h)) / 2;
  return { x, y, w, h };
}

/**
 * Dimensioni finali: il lato lungo non supera maxLongEdge e non si ingrandisce mai.
 * I codificatori video vogliono dimensioni pari.
 */
export function outputSize(rect: Pick<Rect, "w" | "h">, maxLongEdge: number, even = false) {
  const scale = Math.min(1, maxLongEdge / Math.max(rect.w, rect.h));
  const round = (v: number) => (even ? Math.max(2, Math.floor(v / 2) * 2) : Math.max(1, Math.round(v)));
  return { width: round(rect.w * scale), height: round(rect.h * scale) };
}

/** Trasforma un punto in pixel dell'output nel sistema locale (non ruotato) di un overlay centrato in (cx, cy). */
export function toLocal(px: number, py: number, cx: number, cy: number, rotation: number) {
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Sposta il ritaglio di (dx, dy) pixel dell'anteprima larga previewWidth; restituisce il nuovo pan. */
export function panBy(
  c: Pick<MediaComposition, "source" | "rotation" | "aspectRatio" | "crop">,
  dx: number,
  dy: number,
  previewWidth: number
) {
  const { width: sw, height: sh } = rotatedSize(c.source.width, c.source.height, c.rotation);
  const rect = cropRect(c);
  const pxPerSrc = previewWidth / rect.w;
  // Trascinare l'immagine a destra mostra la parte a sinistra: il pan diminuisce.
  const slackX = sw - rect.w;
  const slackY = sh - rect.h;
  return {
    panX: slackX > 0 ? clamp(c.crop.panX - (2 * dx) / pxPerSrc / slackX, -1, 1) : 0,
    panY: slackY > 0 ? clamp(c.crop.panY - (2 * dy) / pxPerSrc / slackY, -1, 1) : 0,
  };
}
