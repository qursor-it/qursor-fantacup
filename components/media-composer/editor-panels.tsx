"use client";

import { useRef, useState } from "react";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { SelectButton } from "primereact/selectbutton";
import { Slider } from "primereact/slider";
import { clampTrim, clipDuration, MAX_VIDEO_SECONDS, MAX_ZOOM } from "@/lib/media/composition";
import { ASPECT_RATIOS } from "@/lib/media/geometry";
import { findTrack, MUSIC_CATALOG } from "@/lib/media/music";
import { FONTS, TEXT_COLORS, type RenderAssets } from "@/lib/media/render";
import { STICKERS } from "@/lib/media/stickers";
import type { MediaComposition, PhotoFilter, QuarterTurn, TextOverlay } from "@/lib/media/types";
import { formatClock, formatSeconds } from "./format";

interface PanelProps {
  composition: MediaComposition;
  onChange: (c: MediaComposition, commit: boolean) => void;
  onCheckpoint: () => void;
}

/** Slider continui: un solo checkpoint per trascinamento, poi aggiornamenti senza storico. */
function useDrag(onCheckpoint: () => void) {
  const started = useRef(false);
  return {
    onSlide: () => {
      if (!started.current) {
        started.current = true;
        onCheckpoint();
      }
    },
    onSlideEnd: () => {
      started.current = false;
    },
  };
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs text-white/70">{label}</span>
    {children}
  </div>
);

export function FormatPanel({ composition: c, onChange, onCheckpoint }: PanelProps) {
  const drag = useDrag(onCheckpoint);
  return (
    <div className="flex flex-col gap-3">
      <SelectButton
        value={c.aspectRatio}
        options={ASPECT_RATIOS}
        optionLabel="label"
        optionValue="id"
        allowEmpty={false}
        onChange={(e) => onChange({ ...c, aspectRatio: e.value, crop: { ...c.crop, panX: 0, panY: 0 } }, true)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          icon="pi pi-refresh"
          label="Ruota"
          severity="secondary"
          onClick={() => onChange({ ...c, rotation: ((c.rotation + 90) % 360) as QuarterTurn }, true)}
        />
        <Button
          type="button"
          icon="pi pi-arrows-h"
          label="Specchia"
          severity="secondary"
          className={c.flipH ? "mc-active" : undefined}
          onClick={() => onChange({ ...c, flipH: !c.flipH }, true)}
        />
        <Button
          type="button"
          label="Ripristina"
          severity="secondary"
          onClick={() => onChange({ ...c, crop: { zoom: 1, panX: 0, panY: 0 } }, true)}
        />
      </div>
      <Row label="Zoom">
        <Slider
          value={c.crop.zoom}
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          onChange={(e) => {
            drag.onSlide();
            onChange({ ...c, crop: { ...c.crop, zoom: e.value as number } }, false);
          }}
          onSlideEnd={drag.onSlideEnd}
        />
      </Row>
      <p className="text-center text-xs text-white/60">Trascina per spostare, pizzica per ingrandire</p>
    </div>
  );
}

const FILTERS: { id: PhotoFilter; label: string }[] = [
  { id: "none", label: "Nessuno" },
  { id: "bw", label: "B/N" },
  { id: "warm", label: "Caldo" },
  { id: "cool", label: "Freddo" },
  { id: "vivid", label: "Vivido" },
];

export function AdjustPanel({ composition: c, onChange, onCheckpoint }: PanelProps) {
  const drag = useDrag(onCheckpoint);
  const slider = (label: string, key: "brightness" | "contrast") => (
    <Row label={label}>
      <Slider
        value={Math.round(c.adjust[key] * 100)}
        min={-100}
        max={100}
        onChange={(e) => {
          drag.onSlide();
          onChange({ ...c, adjust: { ...c.adjust, [key]: (e.value as number) / 100 } }, false);
        }}
        onSlideEnd={drag.onSlideEnd}
      />
    </Row>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <SelectButton
          value={c.adjust.filter}
          options={FILTERS}
          optionLabel="label"
          optionValue="id"
          allowEmpty={false}
          onChange={(e) => onChange({ ...c, adjust: { ...c.adjust, filter: e.value } }, true)}
        />
      </div>
      {slider("Luminosità", "brightness")}
      {slider("Contrasto", "contrast")}
    </div>
  );
}

export function TrimPanel({
  composition: c,
  onChange,
  onCheckpoint,
  onSeek,
}: PanelProps & { onSeek: (t: number) => void }) {
  const drag = useDrag(onCheckpoint);
  const coverDrag = useDrag(onCheckpoint);
  const duration = c.source.durationSeconds ?? 0;
  const trim = c.trim!;
  return (
    <div className="flex flex-col gap-4">
      <Row
        label={`Inizio ${formatClock(trim.start)} · Fine ${formatClock(trim.end)} · Durata ${formatSeconds(trim.end - trim.start)} (max ${MAX_VIDEO_SECONDS} s)`}
      >
        <Slider
          range
          value={[trim.start, trim.end]}
          min={0}
          max={duration}
          step={0.1}
          onChange={(e) => {
            const [s, en] = e.value as [number, number];
            const next = clampTrim(s, en, duration);
            drag.onSlide();
            onChange({ ...c, trim: next }, false);
            onSeek(next.start);
          }}
          onSlideEnd={drag.onSlideEnd}
        />
      </Row>
      <Row label={`Copertina ${formatSeconds(c.coverTime ?? trim.start)}`}>
        <Slider
          value={c.coverTime ?? trim.start}
          min={trim.start}
          max={trim.end}
          step={0.1}
          onChange={(e) => {
            coverDrag.onSlide();
            onChange({ ...c, coverTime: e.value as number }, false);
            onSeek(e.value as number);
          }}
          onSlideEnd={coverDrag.onSlideEnd}
        />
      </Row>
    </div>
  );
}

export function StickerPanel({ onPick }: { onPick: (stickerId: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {STICKERS.map((s) => (
        <Button
          key={s.id}
          type="button"
          text
          aria-label={s.label}
          className="mc-bare"
          style={{ height: 64 }}
          onClick={() => onPick(s.id)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} alt="" className="h-14 w-14 object-contain" />
        </Button>
      ))}
    </div>
  );
}

export function TextEditor({
  initial,
  assets,
  onDone,
}: {
  initial: TextOverlay;
  assets: RenderAssets;
  /** null = testo vuoto: il livello va rimosso (o non aggiunto). */
  onDone: (text: TextOverlay | null) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const style = (patch: Partial<TextOverlay["style"]>) => setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const font = FONTS.find((f) => f.id === draft.style.fontId)!;
  const aligns = [
    { id: "left", icon: "pi pi-align-left" },
    { id: "center", icon: "pi pi-align-center" },
    { id: "right", icon: "pi pi-align-right" },
  ] as const;

  return (
    <div
      className="fixed left-0 top-0 z-[60] flex w-full flex-col gap-3 px-3 pb-3"
      style={{ height: "100dvh", background: "rgba(0,0,0,0.85)", paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/70">Testo</span>
        <Button
          type="button"
          label="Fine"
          rounded
          className="mc-gold"
          onClick={() => onDone(draft.text.trim() ? draft : null)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FONTS.map((f) => (
          <Button
            key={f.id}
            type="button"
            text
            rounded
            className={draft.style.fontId === f.id ? "mc-active" : undefined}
            style={{ border: "1px solid rgba(255,255,255,0.25)" }}
            onClick={() => style({ fontId: f.id })}
          >
            <span style={{ fontFamily: assets.fonts[f.id], fontWeight: f.weight, fontSize: 16 }}>{f.label}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto">
        {TEXT_COLORS.map((color) => (
          <Button
            key={color}
            type="button"
            aria-label={`Colore ${color}`}
            className="mc-bare shrink-0"
            style={{ width: 44, height: 44 }}
            onClick={() => style({ color })}
          >
            <span
              className="block rounded-full"
              style={{
                width: 28,
                height: 28,
                background: color,
                border: draft.style.color === color ? "3px solid #E8A000" : "2px solid rgba(255,255,255,0.6)",
              }}
            />
          </Button>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-white/20" />
        {aligns.map((a) => (
          <Button
            key={a.id}
            type="button"
            icon={a.icon}
            text
            rounded
            aria-label={`Allinea ${a.id}`}
            className={draft.style.align === a.id ? "mc-active shrink-0" : "shrink-0"}
            onClick={() => style({ align: a.id })}
          />
        ))}
        <Button
          type="button"
          icon="pi pi-stop"
          label="Sfondo"
          text
          rounded
          className={draft.style.background ? "mc-active shrink-0" : "shrink-0"}
          onClick={() => style({ background: !draft.style.background })}
        />
      </div>

      <Slider
        value={draft.size}
        min={0.04}
        max={0.2}
        step={0.005}
        onChange={(e) => setDraft((d) => ({ ...d, size: e.value as number }))}
        className="mx-2"
      />

      <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto">
        <InputTextarea
          autoFocus
          autoResize
          rows={2}
          value={draft.text}
          placeholder="Scrivi qualcosa"
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
          className="w-full"
          style={{
            color: draft.style.color,
            fontFamily: assets.fonts[draft.style.fontId],
            fontWeight: font.weight,
            fontSize: Math.max(18, draft.size * 360),
            textAlign: draft.style.align,
          }}
        />
      </div>
    </div>
  );
}

export function MusicPanel({
  composition: c,
  onChange,
  onPrepareAudio,
  onListen,
  onCheckpoint,
}: PanelProps & { onPrepareAudio: () => void; onListen: () => void }) {
  const drag = useDrag(onCheckpoint);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clip = clipDuration(c);
  const track = c.music ? findTrack(c.music.trackId) : undefined;
  const maxStart = track ? Math.max(0, track.durationSeconds - clip) : 0;

  async function choose(trackId: string | null) {
    setError(null);
    if (!trackId) return onChange({ ...c, music: null }, true);
    onPrepareAudio();
    setLoadingId(trackId);
    try {
      await findTrack(trackId)!.load();
      onChange({ ...c, music: { trackId, startTimeSeconds: 0 } }, true);
    } catch (e) {
      console.error(e);
      setError("Impossibile caricare il brano.");
    } finally {
      setLoadingId(null);
    }
  }

  const rowStyle = (active: boolean) => ({
    border: `1px solid ${active ? "#E8A000" : "rgba(255,255,255,0.2)"}`,
    justifyContent: "space-between",
    width: "100%",
    borderRadius: 12,
    padding: "0 12px",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-44 flex-col gap-2 overflow-y-auto">
        <Button type="button" text style={rowStyle(!c.music)} onClick={() => choose(null)}>
          <span>Nessuna musica — audio originale</span>
        </Button>
        {MUSIC_CATALOG.map((t) => (
          <Button
            key={t.id}
            type="button"
            text
            disabled={loadingId !== null}
            style={rowStyle(c.music?.trackId === t.id)}
            onClick={() => choose(t.id)}
          >
            <span className="flex min-w-0 flex-col items-start text-left">
              <span className="truncate">{t.title}</span>
              <span className="text-[11px] font-normal text-white/60">{t.artist}</span>
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              {loadingId === t.id && <i className="pi pi-spin pi-spinner" />}
              {formatClock(t.durationSeconds)}
            </span>
          </Button>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {track && (
        <>
          <Row label={`Parte da ${formatClock(c.music!.startTimeSeconds)}`}>
            <Slider
              value={c.music!.startTimeSeconds}
              min={0}
              max={maxStart}
              step={0.1}
              disabled={maxStart === 0}
              onChange={(e) => {
                drag.onSlide();
                onChange({ ...c, music: { ...c.music!, startTimeSeconds: e.value as number } }, false);
              }}
              onSlideEnd={drag.onSlideEnd}
            />
          </Row>
          {track.durationSeconds < clip && (
            <p className="text-xs text-amber-300">
              Il brano dura {Math.round(track.durationSeconds)} s, meno della clip ({Math.round(clip)} s): l&apos;ultima parte resterà senza audio.
            </p>
          )}
          <Button type="button" icon="pi pi-play" label="Ascolta" severity="secondary" onClick={onListen} />
        </>
      )}
      <p className="text-xs text-white/60">La musica sostituisce l&apos;audio originale del video.</p>
    </div>
  );
}
