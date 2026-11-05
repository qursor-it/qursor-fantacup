"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { exportImage, exportVideo, MediaError } from "@/lib/media/export";
import type { RenderAssets } from "@/lib/media/render";
import type { ExportedMedia, MediaComposition } from "@/lib/media/types";
import type { MediaUploadResult, MediaUploadService } from "@/lib/media/upload";
import { formatMB, formatSeconds } from "./format";
import type { Source } from "./media-composer";

type Exported = { media: ExportedMedia; url: string };
type Publish =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "error"; message: string }
  | { phase: "done"; result: MediaUploadResult };

const FORMAT_LABEL: Record<string, string> = { "video/mp4": "MP4", "image/webp": "WEBP", "image/jpeg": "JPEG" };

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

function download({ media, url }: Exported) {
  const a = document.createElement("a");
  a.href = url;
  a.download = media.file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">{children}</div>
);

export default function ReviewScreen({
  source,
  composition,
  assets,
  uploadService,
  onBack,
  onNewOne,
  onClose,
  onComplete,
}: {
  source: Source;
  composition: MediaComposition;
  assets: RenderAssets;
  uploadService: MediaUploadService;
  onBack: () => void;
  onNewOne: () => void;
  onClose: () => void;
  onComplete?: (result: MediaUploadResult, media: ExportedMedia) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<Exported | null>(null);
  const [publish, setPublish] = useState<Publish>({ phase: "idle" });
  const publishAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    let url: string | null = null;
    let lastPercent = -1;
    const run =
      source.kind === "image"
        ? exportImage(source.bitmap, composition, assets)
        : exportVideo(source.file, composition, assets, {
            signal: abort.signal,
            onProgress: (p) => {
              const percent = Math.round(p * 100);
              if (percent !== lastPercent) {
                lastPercent = percent;
                setProgress(percent);
              }
            },
          });
    run.then(
      (media) => {
        if (abort.signal.aborted) return;
        url = URL.createObjectURL(media.file);
        setExported({ media, url });
      },
      (e) => {
        if (abort.signal.aborted || isAbort(e)) return;
        if (!(e instanceof MediaError)) console.error(e);
        setError(e instanceof MediaError ? e.message : "Non è stato possibile preparare il contenuto.");
      }
    );
    return () => {
      abort.abort();
      if (url) URL.revokeObjectURL(url);
    };
    // Gli input restano gli stessi finché la schermata è aperta; si riesegue solo con "Riprova".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => () => publishAbort.current?.abort(), []);

  function retryExport() {
    setError(null);
    setProgress(0);
    setExported(null);
    setAttempt((a) => a + 1);
  }

  async function send() {
    if (!exported) return;
    const abort = new AbortController();
    publishAbort.current = abort;
    setPublish({ phase: "sending" });
    try {
      const result = await uploadService.upload(exported.media, undefined, abort.signal);
      setPublish({ phase: "done", result });
      onComplete?.(result, exported.media);
    } catch (e) {
      if (isAbort(e)) return setPublish({ phase: "idle" });
      console.error(e);
      setPublish({ phase: "error", message: e instanceof Error ? e.message : "Pubblicazione non riuscita." });
    }
  }

  if (error) {
    return (
      <Center>
        <i className="pi pi-exclamation-triangle text-3xl" style={{ color: "#E8A000" }} />
        <p className="text-sm">{error}</p>
        <div className="flex gap-2">
          <Button type="button" label="Torna all'editor" severity="secondary" rounded onClick={onBack} />
          <Button type="button" label="Riprova" rounded onClick={retryExport} />
        </div>
      </Center>
    );
  }

  if (!exported) {
    return (
      <Center>
        <p className="text-lg" style={{ fontFamily: "var(--font-tallica)" }}>
          Preparazione del contenuto
        </p>
        <div className="w-full max-w-xs">
          {source.kind === "video" ? <ProgressBar value={progress} /> : <ProgressBar mode="indeterminate" style={{ height: 8 }} />}
        </div>
        <Button type="button" label="Annulla" severity="secondary" rounded onClick={onBack} />
      </Center>
    );
  }

  const { media, url } = exported;

  if (publish.phase === "done") {
    const { result } = publish;
    return (
      <Center>
        <i className="pi pi-check-circle text-4xl" style={{ color: "#22C55E" }} />
        <p className="text-lg" style={{ fontFamily: "var(--font-tallica)" }}>
          Pubblicazione simulata completata
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-left text-sm">
          <dt className="text-white/60">ID</dt>
          <dd className="break-all">{result.id}</dd>
          <dt className="text-white/60">File</dt>
          <dd className="break-all">{result.filename}</dd>
          <dt className="text-white/60">Dimensione</dt>
          <dd>{formatMB(result.size)}</dd>
          <dt className="text-white/60">Ora</dt>
          <dd>{new Date(result.createdAt).toLocaleString("it-IT")}</dd>
        </dl>
        <p className="text-xs text-white/60">Nessun file è stato salvato sul server.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" label="Scarica" icon="pi pi-download" severity="secondary" rounded onClick={() => download(exported)} />
          <Button type="button" label="Crea un altro" rounded onClick={onNewOne} />
          <Button type="button" label="Chiudi" severity="secondary" rounded onClick={onClose} />
        </div>
      </Center>
    );
  }

  if (publish.phase === "sending") {
    return (
      <Center>
        <p className="text-lg" style={{ fontFamily: "var(--font-tallica)" }}>
          Simulazione pubblicazione
        </p>
        <div className="w-full max-w-xs">
          <ProgressBar mode="indeterminate" style={{ height: 8 }} />
        </div>
        <p className="max-w-xs text-xs text-white/70">
          Invio simulato: viene inviato solo il riepilogo del file, il file resta sul tuo dispositivo.
        </p>
        <Button type="button" label="Annulla" severity="secondary" rounded onClick={() => publishAbort.current?.abort()} />
      </Center>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 px-4 py-3">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {media.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Anteprima" className="max-h-full max-w-full rounded-xl object-contain" />
        ) : (
          <video src={url} controls playsInline loop className="max-h-full max-w-full rounded-xl" />
        )}
      </div>
      <p className="text-center text-xs text-white/70">
        {[
          FORMAT_LABEL[media.mimeType] ?? media.mimeType,
          `${media.width}×${media.height}`,
          formatMB(media.size),
          media.durationSeconds !== undefined && formatSeconds(media.durationSeconds),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {publish.phase === "error" && <p className="text-center text-sm text-red-400">{publish.message}</p>}
      <div className="flex justify-center gap-2">
        <Button type="button" label="Modifica" severity="secondary" rounded onClick={onBack} />
        <Button type="button" icon="pi pi-download" label="Scarica" severity="secondary" rounded onClick={() => download(exported)} />
        <Button type="button" label={publish.phase === "error" ? "Riprova" : "Pubblica"} rounded onClick={send} />
      </div>
    </div>
  );
}
