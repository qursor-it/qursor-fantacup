"use client";

import { useEffect, useReducer, useState } from "react";
import { Button } from "primereact/button";
import {
  createComposition,
  historyReducer,
  validateMediaFile,
  type History,
  type HistoryAction,
} from "@/lib/media/composition";
import { decodeImage, MediaError, probeVideo } from "@/lib/media/export";
import { resolveFonts, type RenderAssets } from "@/lib/media/render";
import type { ExportedMedia, MediaComposition } from "@/lib/media/types";
import { MockMediaUploadService, type MediaUploadResult, type MediaUploadService } from "@/lib/media/upload";
import CameraView from "./camera-view";
import Editor from "./editor";
import ReviewScreen from "./review-screen";
import "./media-composer.css";

export type Source =
  | { kind: "image"; file: File; bitmap: ImageBitmap }
  | { kind: "video"; file: File; url: string };

type Step = "capture" | "editor" | "review";

type Action = HistoryAction | { type: "reset"; composition: MediaComposition };

const reducer = (h: History, a: Action): History =>
  a.type === "reset" ? { past: [], present: a.composition, future: [] } : historyReducer(h, a);

// Segnaposto finché non c'è una sorgente (lo step "capture" non lo usa).
const emptyHistory = (): History => ({
  past: [],
  present: createComposition("image", { width: 1, height: 1 }),
  future: [],
});

function release(source: Source | null) {
  if (source?.kind === "image") source.bitmap.close();
  else if (source) URL.revokeObjectURL(source.url);
}

export default function MediaComposer({
  onCancel,
  onComplete,
  uploadService,
}: {
  onCancel: () => void;
  onComplete?: (result: MediaUploadResult, media: ExportedMedia) => void;
  uploadService?: MediaUploadService;
}) {
  const [service] = useState(() => uploadService ?? new MockMediaUploadService());
  const [assets] = useState<RenderAssets>(() => ({ stickers: new Map(), fonts: resolveFonts() }));
  const [step, setStep] = useState<Step>("capture");
  const [source, setSource] = useState<Source | null>(null);
  const [history, dispatch] = useReducer(reducer, undefined, emptyHistory);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  // La sorgente precedente si libera quando viene sostituita o il composer si chiude.
  useEffect(() => () => release(source), [source]);

  async function open(file: File, kind: "image" | "video", opts: { flipH: boolean }) {
    setOpening(true);
    setOpenError(null);
    try {
      let next: Source;
      let composition: MediaComposition;
      if (kind === "image") {
        const bitmap = await decodeImage(file);
        next = { kind, file, bitmap };
        composition = createComposition("image", { width: bitmap.width, height: bitmap.height }, opts);
      } else {
        const info = await probeVideo(file);
        next = { kind, file, url: URL.createObjectURL(file) };
        composition = createComposition("video", info, opts);
      }
      setSource(next);
      dispatch({ type: "reset", composition });
      setStep("editor");
    } catch (e) {
      if (!(e instanceof MediaError)) console.error(e);
      setOpenError(e instanceof MediaError ? e.message : "Non è stato possibile aprire il file.");
    } finally {
      setOpening(false);
    }
  }

  function onCapture(file: File, opts: { flipH: boolean }) {
    const check = validateMediaFile(file);
    if (!check.ok) return setOpenError(check.error);
    void open(file, check.kind, opts);
  }

  function backToCapture() {
    setSource(null);
    setStep("capture");
  }

  const composition = history.present;

  return (
    <div
      id="media-composer"
      className="fixed inset-0 z-50 flex h-dvh select-none flex-col overscroll-contain bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative min-h-0 flex-1">
        {step === "capture" && <CameraView onCapture={onCapture} onCancel={onCancel} />}
        {step === "editor" && source && (
          <Editor
            source={source}
            composition={composition}
            assets={assets}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onChange={(c, commit) => dispatch({ type: "set", composition: c, commit })}
            onCheckpoint={() => dispatch({ type: "checkpoint" })}
            onUndo={() => dispatch({ type: "undo" })}
            onRedo={() => dispatch({ type: "redo" })}
            onBack={backToCapture}
            onNext={() => setStep("review")}
          />
        )}
        {step === "review" && source && (
          <ReviewScreen
            source={source}
            composition={composition}
            assets={assets}
            uploadService={service}
            onBack={() => setStep("editor")}
            onNewOne={backToCapture}
            onClose={onCancel}
            onComplete={onComplete}
          />
        )}

        {(opening || openError) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
            {opening ? (
              <>
                <i className="pi pi-spin pi-spinner text-3xl" />
                <p className="text-sm">Apertura in corso</p>
              </>
            ) : (
              <>
                <p className="text-sm">{openError}</p>
                <Button type="button" label="Indietro" rounded onClick={() => setOpenError(null)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
