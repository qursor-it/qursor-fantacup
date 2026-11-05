"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cropRect, outputSize, panBy, toLocal } from "@/lib/media/geometry";
import { ensureStickers, loadFonts, overlayBox, renderComposition, type RenderAssets } from "@/lib/media/render";
import type { MediaComposition, MediaOverlay } from "@/lib/media/types";

const MIN_HIT_CSS_PX = 24;
const DOUBLE_TAP_MS = 320;
const MOVE_THRESHOLD_PX = 4;

type Gesture =
  | { type: "move"; id: string; startX: number; startY: number; ox: number; oy: number }
  | { type: "pan"; startX: number; startY: number; comp: MediaComposition }
  | { type: "pinch"; id: string | null; dist: number; angle: number; size: number; rotation: number; zoom: number };

interface Props {
  composition: MediaComposition;
  source: ImageBitmap | HTMLVideoElement;
  assets: RenderAssets;
  selectedId: string | null;
  mode: "overlays" | "crop";
  onSelect: (id: string | null) => void;
  onChange: (c: MediaComposition, commit: boolean) => void;
  onCheckpoint: () => void;
  onEditText: (id: string) => void;
}

export default function EditorCanvas({
  composition,
  source,
  assets,
  selectedId,
  mode,
  onSelect,
  onChange,
  onCheckpoint,
  onEditText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Sale quando sticker o font finiscono di caricarsi: forza il ridisegno.
  const [assetsVersion, setAssetsVersion] = useState(0);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const checkpointed = useRef(false);
  const lastTap = useRef({ id: "", time: 0 });
  const lastWheel = useRef(0);

  const { w: rw, h: rh } = cropRect(composition);
  const aspect = rw / rh;
  const cssW = Math.max(0, Math.min(box.w, box.h * aspect));
  const cssH = cssW / aspect;

  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    const bump = () => alive && setAssetsVersion((v) => v + 1);
    ensureStickers(composition.overlays, assets).then(bump, console.error);
    return () => {
      alive = false;
    };
  }, [composition.overlays, assets]);

  useEffect(() => {
    let alive = true;
    loadFonts(assets.fonts).then(() => alive && setAssetsVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, [assets]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssW < 1) return;
    if (source instanceof HTMLVideoElement && source.readyState < 2) return;
    const rect = cropRect(composition);
    const max = outputSize(rect, 1920);
    const W = Math.min(max.width, Math.max(1, Math.round(cssW * (window.devicePixelRatio || 1))));
    const H = Math.max(1, Math.round((W * rect.h) / rect.w));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext("2d")!;
    renderComposition(ctx, source, composition, W, H, assets);

    const sel = selectedId ? composition.overlays.find((o) => o.id === selectedId) : undefined;
    if (sel) {
      const b = overlayBox(ctx, sel, W, H, assets);
      const k = W / cssW;
      const pad = 6 * k;
      ctx.save();
      ctx.translate(b.cx, b.cy);
      ctx.rotate(sel.rotation);
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 1.5 * k;
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([6 * k, 4 * k]);
      ctx.strokeRect(-b.w / 2 - pad, -b.h / 2 - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.restore();
    }
  }, [source, composition, assets, selectedId, cssW]);

  // Foto: un ridisegno per frame di animazione. Video: ciclo sui fotogrammi mentre riproduce.
  useEffect(() => {
    const v = source instanceof HTMLVideoElement ? source : null;
    let raf = 0;
    let cancelLoop: (() => void) | null = null;
    const redraw = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          draw();
        });
      }
    };
    const loop = () => {
      if (!v || cancelLoop) return;
      const tick = () => {
        cancelLoop = null;
        draw();
        if (!v.paused && !v.ended) loop();
      };
      if ("requestVideoFrameCallback" in v) {
        const id = v.requestVideoFrameCallback(tick);
        cancelLoop = () => v.cancelVideoFrameCallback(id);
      } else {
        const id = requestAnimationFrame(tick);
        cancelLoop = () => cancelAnimationFrame(id);
      }
    };
    redraw();
    if (v) {
      v.addEventListener("play", loop);
      for (const ev of ["seeked", "loadeddata", "pause"]) v.addEventListener(ev, redraw);
      if (!v.paused) loop();
    }
    return () => {
      cancelAnimationFrame(raf);
      cancelLoop?.();
      if (v) {
        v.removeEventListener("play", loop);
        for (const ev of ["seeked", "loadeddata", "pause"]) v.removeEventListener(ev, redraw);
      }
    };
    // assetsVersion: ridisegna quando sticker e font sono pronti.
  }, [source, draw, assetsVersion]);

  // ---------- Gesti ----------

  const patchOverlay = (id: string, patch: Partial<MediaOverlay>): MediaComposition => ({
    ...composition,
    overlays: composition.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as MediaOverlay) : o)),
  });

  function local(e: { clientX: number; clientY: number; currentTarget: Element }) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitTest(x: number, y: number): MediaOverlay | undefined {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const k = canvas.width / cssW;
    for (let i = composition.overlays.length - 1; i >= 0; i--) {
      const o = composition.overlays[i];
      const b = overlayBox(ctx, o, canvas.width, canvas.height, assets);
      const p = toLocal(x * k, y * k, b.cx, b.cy, o.rotation);
      const halfW = Math.max(b.w / 2, MIN_HIT_CSS_PX * k) + 6 * k;
      const halfH = Math.max(b.h / 2, MIN_HIT_CSS_PX * k) + 6 * k;
      if (Math.abs(p.x) <= halfW && Math.abs(p.y) <= halfH) return o;
    }
    return undefined;
  }

  const pinchMetrics = () => {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  };

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    if (pointers.current.size === 1) {
      checkpointed.current = false;
      if (mode === "crop") {
        gesture.current = { type: "pan", startX: pt.x, startY: pt.y, comp: composition };
        return;
      }
      const hit = hitTest(pt.x, pt.y);
      onSelect(hit?.id ?? null);
      gesture.current = hit ? { type: "move", id: hit.id, startX: pt.x, startY: pt.y, ox: hit.x, oy: hit.y } : null;
    } else if (pointers.current.size === 2) {
      const sel = mode === "overlays" ? composition.overlays.find((o) => o.id === selectedId) : undefined;
      if (mode === "overlays" && !sel) return;
      gesture.current = {
        type: "pinch",
        id: sel?.id ?? null,
        ...pinchMetrics(),
        size: sel?.size ?? 0,
        rotation: sel?.rotation ?? 0,
        zoom: composition.crop.zoom,
      };
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);

    if (g.type === "pinch") {
      if (pointers.current.size < 2) return;
      const m = pinchMetrics();
      if (!checkpointed.current) {
        checkpointed.current = true;
        onCheckpoint();
      }
      if (g.id) {
        onChange(patchOverlay(g.id, { size: g.size * (m.dist / g.dist), rotation: g.rotation + (m.angle - g.angle) }), false);
      } else {
        onChange({ ...composition, crop: { ...composition.crop, zoom: g.zoom * (m.dist / g.dist) } }, false);
      }
      return;
    }

    const dx = pt.x - g.startX;
    const dy = pt.y - g.startY;
    if (!checkpointed.current) {
      if (Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) return;
      checkpointed.current = true;
      onCheckpoint();
    }
    if (g.type === "move") {
      onChange(patchOverlay(g.id, { x: g.ox + dx / cssW, y: g.oy + dy / cssH }), false);
    } else {
      onChange({ ...g.comp, crop: { ...g.comp.crop, ...panBy(g.comp, dx, dy, cssW) } }, false);
    }
  }

  function endPointer(e: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      gesture.current = null;
      return;
    }
    gesture.current = null;
    // Tocco senza spostamento su un testo: il secondo tocco ravvicinato lo modifica.
    if (e.type === "pointerup" && g?.type === "move" && !checkpointed.current) {
      const o = composition.overlays.find((x) => x.id === g.id);
      const now = e.timeStamp;
      if (o?.type === "text" && lastTap.current.id === o.id && now - lastTap.current.time < DOUBLE_TAP_MS) {
        lastTap.current = { id: "", time: 0 };
        onEditText(o.id);
      } else {
        lastTap.current = { id: g.id, time: now };
      }
    }
  }

  // Rotella (desktop): listener nativo non passivo per poter bloccare lo scroll della pagina.
  useEffect(() => {
    const el = canvasRef.current!.parentElement!;
    function onWheel(e: WheelEvent) {
      const sel = mode === "overlays" ? composition.overlays.find((o) => o.id === selectedId) : undefined;
      if (mode === "overlays" && !sel) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      if (e.timeStamp - lastWheel.current > 500) onCheckpoint();
      lastWheel.current = e.timeStamp;
      if (sel) {
        onChange({ ...composition, overlays: composition.overlays.map((o) => (o.id === sel.id ? { ...o, size: o.size * factor } : o)) }, false);
      } else {
        onChange({ ...composition, crop: { ...composition.crop, zoom: composition.crop.zoom * factor } }, false);
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [composition, mode, selectedId, onChange, onCheckpoint]);

  return (
    <div ref={containerRef} className="relative min-h-0 w-full flex-1">
      <div
        className="absolute inset-0 m-auto"
        style={{ width: cssW, height: cssH, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </div>
  );
}
