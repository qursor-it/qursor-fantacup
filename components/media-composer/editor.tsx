"use client";

import { useState } from "react";
import { Button } from "primereact/button";
import { ConfirmPopup, confirmPopup } from "primereact/confirmpopup";
import type { RenderAssets } from "@/lib/media/render";
import type { MediaComposition, MediaOverlay, TextOverlay } from "@/lib/media/types";
import EditorCanvas from "./editor-canvas";
import { AdjustPanel, FormatPanel, MusicPanel, StickerPanel, TextEditor, TrimPanel } from "./editor-panels";
import type { Source } from "./media-composer";
import { useVideoPreview } from "./use-video-preview";

type Tool = "format" | "adjust" | "trim" | "sticker" | "music";

const newText = (): TextOverlay => ({
  id: crypto.randomUUID(),
  type: "text",
  text: "",
  x: 0.5,
  y: 0.4,
  size: 0.08,
  rotation: 0,
  style: { color: "#FFFFFF", fontId: "inter", align: "center", background: false },
});

interface Props {
  source: Source;
  composition: MediaComposition;
  assets: RenderAssets;
  canUndo: boolean;
  canRedo: boolean;
  onChange: (c: MediaComposition, commit: boolean) => void;
  onCheckpoint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onBack: () => void;
  onNext: () => void;
}

export default function Editor({
  source,
  composition: c,
  assets,
  canUndo,
  canRedo,
  onChange,
  onCheckpoint,
  onUndo,
  onRedo,
  onBack,
  onNext,
}: Props) {
  const isVideo = source.kind === "video";
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textEdit, setTextEdit] = useState<{ overlay: TextOverlay; isNew: boolean } | null>(null);
  const preview = useVideoPreview(video, c);

  const canvasSource = isVideo ? video : source.bitmap;
  const selectedIndex = c.overlays.findIndex((o) => o.id === selectedId);
  const selected = c.overlays[selectedIndex] as MediaOverlay | undefined;

  const tools: { id: Tool | "text"; label: string; icon: string }[] = [
    { id: "format", label: "Formato", icon: "pi pi-expand" },
    ...(isVideo
      ? [{ id: "trim" as const, label: "Taglia", icon: "pi pi-clock" }]
      : [{ id: "adjust" as const, label: "Regola", icon: "pi pi-sliders-h" }]),
    { id: "text", label: "Testo", icon: "pi pi-pencil" },
    { id: "sticker", label: "Sticker", icon: "pi pi-star" },
    ...(isVideo ? [{ id: "music" as const, label: "Musica", icon: "pi pi-headphones" }] : []),
  ];

  function pickTool(id: Tool | "text") {
    if (id === "text") {
      setTool(null);
      return setTextEdit({ overlay: newText(), isNew: true });
    }
    setTool((t) => (t === id ? null : id));
    if (id === "format") setSelectedId(null);
  }

  function confirmBack(e: React.MouseEvent<HTMLElement>) {
    if (!canUndo) return onBack();
    confirmPopup({
      target: e.currentTarget,
      message: "Scartare le modifiche?",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Scarta",
      rejectLabel: "Continua",
      accept: onBack,
    });
  }

  function addSticker(stickerId: string) {
    const overlay: MediaOverlay = { id: crypto.randomUUID(), type: "sticker", stickerId, x: 0.5, y: 0.5, size: 0.35, rotation: 0 };
    onChange({ ...c, overlays: [...c.overlays, overlay] }, true);
    setSelectedId(overlay.id);
    setTool(null);
  }

  function finishText(text: TextOverlay | null) {
    const edit = textEdit!;
    setTextEdit(null);
    if (!text) {
      if (edit.isNew) return;
      onChange({ ...c, overlays: c.overlays.filter((o) => o.id !== edit.overlay.id) }, true);
      return setSelectedId(null);
    }
    const overlays = edit.isNew ? [...c.overlays, text] : c.overlays.map((o) => (o.id === text.id ? text : o));
    onChange({ ...c, overlays }, true);
    setSelectedId(text.id);
  }

  function editText(id: string) {
    const overlay = c.overlays.find((o) => o.id === id);
    if (overlay?.type === "text") setTextEdit({ overlay, isNew: false });
  }

  function moveLayer(delta: number) {
    const to = selectedIndex + delta;
    if (selectedIndex < 0 || to < 0 || to >= c.overlays.length) return;
    const overlays = [...c.overlays];
    [overlays[selectedIndex], overlays[to]] = [overlays[to], overlays[selectedIndex]];
    onChange({ ...c, overlays }, true);
  }

  function removeSelected() {
    onChange({ ...c, overlays: c.overlays.filter((o) => o.id !== selectedId) }, true);
    setSelectedId(null);
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <ConfirmPopup />

      <div className="flex items-center justify-between gap-1 px-2 py-1">
        <Button type="button" icon="pi pi-arrow-left" text rounded aria-label="Indietro" onClick={confirmBack} />
        <div className="flex items-center">
          <Button type="button" icon="pi pi-undo" text rounded aria-label="Annulla" disabled={!canUndo} onClick={onUndo} />
          <Button type="button" icon="pi pi-undo" text rounded aria-label="Ripeti" disabled={!canRedo} onClick={onRedo} style={{ transform: "scaleX(-1)" }} />
        </div>
        <Button type="button" label="Avanti" rounded onClick={onNext} />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-2">
        {isVideo && (
          <video
            ref={setVideo}
            src={source.url}
            playsInline
            preload="auto"
            // iOS non carica il primo fotogramma finché non si chiede una posizione.
            onLoadedMetadata={(e) => (e.currentTarget.currentTime = c.trim?.start ?? 0)}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          />
        )}
        {canvasSource && (
          <EditorCanvas
            composition={c}
            source={canvasSource}
            assets={assets}
            selectedId={tool === "format" ? null : selectedId}
            mode={tool === "format" ? "crop" : "overlays"}
            onSelect={setSelectedId}
            onChange={onChange}
            onCheckpoint={onCheckpoint}
            onEditText={editText}
          />
        )}

        {isVideo && (
          <Button
            type="button"
            icon={preview.playing ? "pi pi-pause" : "pi pi-play"}
            rounded
            aria-label={preview.playing ? "Pausa" : "Riproduci"}
            onClick={preview.toggle}
            className="absolute! bottom-2 left-4"
            style={{ background: "rgba(0,0,0,0.55)", border: 0 }}
          />
        )}

        {selected && tool !== "format" && (
          <div
            className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center rounded-full px-1"
            style={{ background: "rgba(0,0,0,0.65)" }}
          >
            {selected.type === "text" && (
              <Button type="button" icon="pi pi-pencil" text rounded aria-label="Modifica" onClick={() => editText(selected.id)} />
            )}
            <Button type="button" icon="pi pi-angle-double-up" text rounded aria-label="Porta avanti" disabled={selectedIndex === c.overlays.length - 1} onClick={() => moveLayer(1)} />
            <Button type="button" icon="pi pi-angle-double-down" text rounded aria-label="Porta indietro" disabled={selectedIndex === 0} onClick={() => moveLayer(-1)} />
            <Button type="button" icon="pi pi-trash" text rounded severity="danger" aria-label="Elimina" onClick={removeSelected} />
          </div>
        )}
      </div>

      {tool && (
        <div
          className="max-h-[42dvh] shrink-0 overflow-y-auto px-4 py-3"
          style={{ background: "rgba(20,20,24,0.92)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
        >
          {tool === "format" && <FormatPanel composition={c} onChange={onChange} onCheckpoint={onCheckpoint} />}
          {tool === "adjust" && <AdjustPanel composition={c} onChange={onChange} onCheckpoint={onCheckpoint} />}
          {tool === "trim" && <TrimPanel composition={c} onChange={onChange} onCheckpoint={onCheckpoint} onSeek={preview.seek} />}
          {tool === "sticker" && <StickerPanel onPick={addSticker} />}
          {tool === "music" && (
            <MusicPanel
              composition={c}
              onChange={onChange}
              onCheckpoint={onCheckpoint}
              onPrepareAudio={preview.prepareAudio}
              onListen={() => preview.play(true)}
            />
          )}
        </div>
      )}

      <div className="flex shrink-0 justify-around px-1 py-1" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        {tools.map((t) => (
          <Button
            key={t.id}
            type="button"
            icon={t.icon}
            label={t.label}
            iconPos="top"
            text
            className={`mc-tool flex-1 ${tool === t.id ? "mc-active" : ""}`}
            onClick={() => pickTool(t.id)}
          />
        ))}
      </div>

      {textEdit && <TextEditor initial={textEdit.overlay} assets={assets} onDone={finishText} />}
    </div>
  );
}
