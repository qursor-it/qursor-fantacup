// Modello del Media Composer. Tutto qui è serializzabile: File, Blob, stream e URL temporanei
// restano nei componenti, mai nella composizione.

export type MediaKind = "image" | "video";

export type AspectRatio = "original" | "1:1" | "4:5" | "9:16";

export type QuarterTurn = 0 | 90 | 180 | 270;

export type PhotoFilter = "none" | "bw" | "warm" | "cool" | "vivid";

export type FontId = "inter" | "tallica" | "serif";

/** zoom >= 1; pan in [-1, 1]: -1 = bordo sinistro/alto della sorgente, 1 = bordo destro/basso. */
export interface Crop {
  zoom: number;
  panX: number;
  panY: number;
}

/** Valori in [-1, 1], 0 = invariato. Solo foto. */
export interface Adjustments {
  filter: PhotoFilter;
  brightness: number;
  contrast: number;
}

export interface TextStyle {
  color: string;
  fontId: FontId;
  align: "left" | "center" | "right";
  background: boolean;
}

interface OverlayBase {
  id: string;
  /** Centro, normalizzato su larghezza e altezza dell'output (0..1). */
  x: number;
  y: number;
  /** Testo: altezza del font; sticker: larghezza. Frazione della larghezza dell'output. */
  size: number;
  /** Radianti, senso orario. */
  rotation: number;
}

export interface TextOverlay extends OverlayBase {
  type: "text";
  text: string;
  style: TextStyle;
}

export interface StickerOverlay extends OverlayBase {
  type: "sticker";
  stickerId: string;
}

/** L'ordine nell'array è l'ordine dei livelli: l'ultimo è sopra. */
export type MediaOverlay = TextOverlay | StickerOverlay;

export type MusicSelection = { trackId: string; startTimeSeconds: number } | null;

export interface MediaComposition {
  kind: MediaKind;
  /** Dimensioni di visualizzazione della sorgente (orientamento dei metadati già applicato). */
  source: { width: number; height: number; durationSeconds?: number };
  aspectRatio: AspectRatio;
  rotation: QuarterTurn;
  /** Specchia orizzontalmente; attivo per default sui contenuti della camera frontale. */
  flipH: boolean;
  crop: Crop;
  adjust: Adjustments;
  /** Solo video. */
  trim: { start: number; end: number } | null;
  /** Solo video: istante della sorgente usato come copertina. */
  coverTime: number | null;
  overlays: MediaOverlay[];
  /** Solo video: sostituisce l'audio originale. */
  music: MusicSelection;
}

export interface ExportedMedia {
  file: File;
  type: MediaKind;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  durationSeconds?: number;
  thumbnail?: Blob;
}
