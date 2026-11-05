import { cropRect, rotatedSize } from "./geometry";
import { loadStickerImage, STICKERS } from "./stickers";
import type { Adjustments, FontId, MediaComposition, MediaOverlay, TextOverlay } from "./types";

// Unico renderer per anteprima ed export: cambia solo la dimensione del canvas,
// tutte le misure degli overlay sono frazioni della larghezza dell'output.

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const FONTS: { id: FontId; label: string; weight: number; cssVar?: string; fallback: string }[] = [
  { id: "inter", label: "Moderno", weight: 800, cssVar: "--font-inter", fallback: "Arial, sans-serif" },
  { id: "tallica", label: "Stadio", weight: 500, fallback: "Tallica, Impact, sans-serif" },
  { id: "serif", label: "Classico", weight: 700, fallback: "Georgia, 'Times New Roman', serif" },
];

export const TEXT_COLORS = ["#FFFFFF", "#09144C", "#0107A3", "#E8A000", "#EF4444", "#22C55E"];

export interface RenderAssets {
  stickers: Map<string, HTMLImageElement>;
  /** font-family CSS reale per ogni FontId (next/font genera nomi con hash). */
  fonts: Record<FontId, string>;
}

export function resolveFonts(): Record<FontId, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    FONTS.map((f) => {
      const fromVar = f.cssVar ? style.getPropertyValue(f.cssVar).trim() : "";
      return [f.id, fromVar ? `${fromVar}, ${f.fallback}` : f.fallback];
    })
  ) as Record<FontId, string>;
}

/** Il canvas non aspetta i web font: vanno caricati prima di disegnare. */
export async function loadFonts(fonts: Record<FontId, string>) {
  await Promise.all(
    FONTS.map((f) => document.fonts.load(`${f.weight} 48px ${fonts[f.id]}`).catch(() => []))
  );
}

const fontSpec = (o: TextOverlay, px: number, assets: RenderAssets) => {
  const f = FONTS.find((x) => x.id === o.style.fontId) ?? FONTS[0];
  return `${f.weight} ${px}px ${assets.fonts[f.id]}`;
};

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
}

function textLayout(ctx: Ctx, o: TextOverlay, W: number, assets: RenderAssets) {
  const px = o.size * W;
  ctx.font = fontSpec(o, px, assets);
  const lines = o.text.split("\n");
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lineH = px * 1.2;
  const padX = px * 0.4;
  const padY = px * 0.25;
  return { px, lines, lineH, padX, padY, w: Math.max(...widths) + padX * 2, h: lines.length * lineH + padY * 2 };
}

/** Riquadro non ruotato dell'overlay in pixel dell'output (centro + dimensioni). */
export function overlayBox(ctx: Ctx, o: MediaOverlay, W: number, H: number, assets: RenderAssets) {
  const cx = o.x * W;
  const cy = o.y * H;
  if (o.type === "text") {
    const { w, h } = textLayout(ctx, o, W, assets);
    return { cx, cy, w, h };
  }
  const img = assets.stickers.get(o.stickerId);
  const w = o.size * W;
  return { cx, cy, w, h: img ? (w * img.naturalHeight) / img.naturalWidth : w };
}

function drawText(ctx: Ctx, o: TextOverlay, W: number, assets: RenderAssets) {
  if (!o.text.trim()) return;
  const { px, lines, lineH, padX, padY, w, h } = textLayout(ctx, o, W, assets);
  if (o.style.background) {
    ctx.fillStyle = o.style.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, px * 0.3);
    ctx.fill();
    ctx.fillStyle = isLight(o.style.color) ? "#09144C" : "#FFFFFF";
  } else {
    ctx.fillStyle = o.style.color;
    // Ombra in pixel dell'output: proporzionale al font, quindi uguale in anteprima ed export.
    ctx.shadowColor = isLight(o.style.color) ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.45)";
    ctx.shadowBlur = px * 0.12;
  }
  ctx.textAlign = o.style.align;
  ctx.textBaseline = "middle";
  const x = o.style.align === "left" ? -w / 2 + padX : o.style.align === "right" ? w / 2 - padX : 0;
  lines.forEach((line, i) => ctx.fillText(line, x, -h / 2 + padY + lineH * (i + 0.5)));
}

export function drawOverlays(ctx: Ctx, overlays: MediaOverlay[], W: number, H: number, assets: RenderAssets) {
  for (const o of overlays) {
    ctx.save();
    ctx.translate(o.x * W, o.y * H);
    ctx.rotate(o.rotation);
    if (o.type === "text") {
      drawText(ctx, o, W, assets);
    } else {
      const img = assets.stickers.get(o.stickerId);
      if (img) {
        const { w, h } = overlayBox(ctx, o, W, H, assets);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    }
    ctx.restore();
  }
}

export const isNeutral = (a: Adjustments) => a.filter === "none" && a.brightness === 0 && a.contrast === 0;

/** Filtri e luminosità/contrasto sui pixel RGBA (in place). Implementati a mano: ctx.filter manca su Safari. */
export function applyAdjustments(data: Uint8ClampedArray, a: Adjustments) {
  const bright = a.brightness * 80;
  const k = a.contrast >= 0 ? 1 + a.contrast : 1 + a.contrast * 0.8;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    switch (a.filter) {
      case "bw":
        r = g = b = l;
        break;
      case "warm":
        r += 20;
        b -= 20;
        break;
      case "cool":
        r -= 20;
        b += 20;
        break;
      case "vivid":
        r = l + (r - l) * 1.4;
        g = l + (g - l) * 1.4;
        b = l + (b - l) * 1.4;
        break;
    }
    data[i] = (r - 128) * k + 128 + bright;
    data[i + 1] = (g - 128) * k + 128 + bright;
    data[i + 2] = (b - 128) * k + 128 + bright;
  }
}

/**
 * Disegna un fotogramma completo: ritaglio, rotazione, specchio, regolazioni e overlay.
 * src deve avere le dimensioni di composition.source (orientamento dei metadati già applicato).
 */
export function renderComposition(
  ctx: Ctx,
  src: CanvasImageSource,
  c: MediaComposition,
  W: number,
  H: number,
  assets: RenderAssets
) {
  const rect = cropRect(c);
  const { width: rw, height: rh } = rotatedSize(c.source.width, c.source.height, c.rotation);
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = "high";
  ctx.scale(W / rect.w, H / rect.h);
  ctx.translate(-rect.x, -rect.y);
  if (c.flipH) {
    ctx.translate(rw, 0);
    ctx.scale(-1, 1);
  }
  if (c.rotation === 90) ctx.translate(rw, 0);
  else if (c.rotation === 180) ctx.translate(rw, rh);
  else if (c.rotation === 270) ctx.translate(0, rh);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.drawImage(src, 0, 0, c.source.width, c.source.height);
  ctx.restore();

  if (c.kind === "image" && !isNeutral(c.adjust)) {
    const img = ctx.getImageData(0, 0, W, H);
    applyAdjustments(img.data, c.adjust);
    ctx.putImageData(img, 0, 0);
  }
  drawOverlays(ctx, c.overlays, W, H, assets);
}

/** Carica gli sticker usati dalla composizione (servono già decodificati per disegnarli). */
export async function ensureStickers(overlays: MediaOverlay[], assets: RenderAssets) {
  for (const o of overlays) {
    if (o.type !== "sticker" || assets.stickers.has(o.stickerId)) continue;
    const sticker = STICKERS.find((s) => s.id === o.stickerId);
    if (sticker) assets.stickers.set(o.stickerId, await loadStickerImage(sticker.src));
  }
}
