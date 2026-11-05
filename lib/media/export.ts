import { clipDuration, MAX_SOURCE_VIDEO_SECONDS } from "./composition";
import { cropRect, outputSize } from "./geometry";
import { copyInto, findTrack, sliceAudio } from "./music";
import { ensureStickers, loadFonts, renderComposition, type RenderAssets } from "./render";
import type { ExportedMedia, MediaComposition } from "./types";

export const IMAGE_EXPORT_CONFIG = {
  maxLongEdge: 2048,
  preferredFormat: "image/webp",
  fallbackFormat: "image/jpeg",
  quality: 0.82,
};

export const VIDEO_EXPORT_CONFIG = {
  maxLongEdge: 1920,
  maxFps: 30,
  /** Riferito a 1080x1920, scalato sui pixel reali. */
  targetVideoBitrate: 3_000_000,
  targetAudioBitrate: 128_000,
  thumbnailLongEdge: 720,
};

/** Errore con messaggio già adatto all'utente. */
export class MediaError extends Error {}

export interface ExportOptions {
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const extOf = (mime: string) => (mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : "mp4");

const fileName = (mime: string) => `fantacup-${Date.now()}.${extOf(mime)}`;

function canvas2d(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}

const abortError = () => new DOMException("Esportazione annullata", "AbortError");

// ---------- Foto ----------

/** Decodifica con orientamento EXIF applicato; la ricodifica su canvas scarta tutti i metadati. */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const heic = /\.(heic|heif)$/i.test(file.name) || /hei[cf]/.test(file.type);
    throw new MediaError(
      heic
        ? "Questo browser non sa aprire le foto HEIC. Su iPhone usa Safari, oppure imposta la fotocamera su \"Più compatibile\" (JPEG)."
        : "Impossibile leggere la foto: il formato non è supportato da questo browser."
    );
  }
}

export async function exportImage(
  bitmap: ImageBitmap,
  c: MediaComposition,
  assets: RenderAssets
): Promise<ExportedMedia> {
  await Promise.all([ensureStickers(c.overlays, assets), loadFonts(assets.fonts)]);
  const { width, height } = outputSize(cropRect(c), IMAGE_EXPORT_CONFIG.maxLongEdge);
  const { canvas, ctx } = canvas2d(width, height);
  renderComposition(ctx, bitmap, c, width, height, assets);

  const { preferredFormat, fallbackFormat, quality } = IMAGE_EXPORT_CONFIG;
  let blob = await toBlob(canvas, preferredFormat, quality);
  // Safari non codifica WebP e restituisce PNG: in quel caso JPEG.
  if (!blob || blob.type !== preferredFormat) blob = await toBlob(canvas, fallbackFormat, quality);
  canvas.width = canvas.height = 0;
  if (!blob) throw new MediaError("Il browser non è riuscito a codificare l'immagine.");
  return {
    file: new File([blob], fileName(blob.type), { type: blob.type }),
    type: "image",
    mimeType: blob.type,
    width,
    height,
    size: blob.size,
  };
}

// ---------- Video ----------

export interface VideoInfo {
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
}

const loadMediabunny = () => import("mediabunny");

async function openInput(file: Blob) {
  const mb = await loadMediabunny();
  return { mb, input: new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS }) };
}

/** Legge dimensioni e durata con Mediabunny: il tag video riporta durate infinite per i WebM di MediaRecorder. */
export async function probeVideo(file: File): Promise<VideoInfo> {
  if (typeof VideoDecoder === "undefined" || typeof VideoEncoder === "undefined") {
    throw new MediaError("Questo browser non supporta l'elaborazione video (WebCodecs). Aggiorna il browser o usa Chrome/Safari recenti.");
  }
  const { input } = await openInput(file);
  try {
    const video = await input.getPrimaryVideoTrack().catch(() => null);
    if (!video) throw new MediaError("Formato video non supportato o file danneggiato.");
    if (!(await video.canDecode())) throw new MediaError("Questo browser non sa decodificare il codec di questo video.");
    const audio = await input.getPrimaryAudioTrack();
    if (audio && !(await audio.canDecode())) {
      throw new MediaError("Questo browser non sa elaborare l'audio di questo video.");
    }
    const durationSeconds = await input.computeDuration();
    // Un secondo di margine: la registrazione si ferma con il timer e può superare di poco il limite.
    if (durationSeconds > MAX_SOURCE_VIDEO_SECONDS + 1) {
      throw new MediaError(`Video troppo lungo: massimo ${MAX_SOURCE_VIDEO_SECONDS} secondi.`);
    }
    return { width: video.displayWidth, height: video.displayHeight, durationSeconds, hasAudio: !!audio };
  } finally {
    input.dispose();
  }
}

const videoBitrate = (w: number, h: number) =>
  Math.round(Math.min(1, Math.max(0.35, (w * h) / (1080 * 1920))) * VIDEO_EXPORT_CONFIG.targetVideoBitrate);

/** Audio della clip: il brano scelto oppure l'audio originale nell'intervallo di trim. Durata esatta della clip. */
async function clipAudio(
  mb: typeof import("mediabunny"),
  input: InstanceType<typeof import("mediabunny").Input>,
  c: MediaComposition
): Promise<AudioBuffer | null> {
  const { start, end } = c.trim!;
  const duration = end - start;
  if (c.music) {
    const track = findTrack(c.music.trackId);
    if (!track) throw new MediaError("Il brano selezionato non è più disponibile.");
    return sliceAudio(await track.load(), c.music.startTimeSeconds, duration);
  }
  const audio = await input.getPrimaryAudioTrack();
  if (!audio) return null;
  let out: AudioBuffer | null = null;
  for await (const { buffer, timestamp } of new mb.AudioBufferSink(audio).buffers(start, end)) {
    out ??= new AudioBuffer({
      length: Math.round(duration * buffer.sampleRate),
      numberOfChannels: Math.min(2, buffer.numberOfChannels),
      sampleRate: buffer.sampleRate,
    });
    const offset = Math.round((timestamp - start) * buffer.sampleRate);
    for (let ch = 0; ch < out.numberOfChannels; ch++) {
      copyInto(out.getChannelData(ch), buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)), offset);
    }
  }
  return out;
}

/**
 * Ricodifica la clip in MP4 H.264/AAC: trim, ritaglio, rotazione, overlay disegnati su ogni fotogramma,
 * audio originale o brano. Il risultato viene riletto e verificato prima di essere restituito.
 */
export async function exportVideo(
  file: File,
  c: MediaComposition,
  assets: RenderAssets,
  { onProgress, signal }: ExportOptions = {}
): Promise<ExportedMedia> {
  const { mb, input } = await openInput(file);
  let output: InstanceType<typeof mb.Output> | null = null;
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video || !c.trim) throw new MediaError("Il file non contiene video.");
    const { start, end } = c.trim;
    const duration = clipDuration(c);
    const rect = cropRect(c);
    const { width, height } = outputSize(rect, VIDEO_EXPORT_CONFIG.maxLongEdge, true);
    const bitrate = videoBitrate(width, height);

    if (!(await mb.canEncodeVideo("avc", { width, height, bitrate }))) {
      throw new MediaError(`Questo dispositivo non sa codificare video H.264 a ${width}x${height}.`);
    }
    if (!(await mb.canEncodeAudio("aac"))) {
      // Firefox e alcuni browser non hanno AAC in WebCodecs: encoder WASM caricato solo qui.
      (await import("@mediabunny/aac-encoder")).registerAacEncoder();
    }
    await Promise.all([ensureStickers(c.overlays, assets), loadFonts(assets.fonts)]);
    const audioBuffer = await clipAudio(mb, input, c);
    if (signal?.aborted) throw abortError();

    const { canvas, ctx } = canvas2d(width, height);
    output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
    const videoSource = new mb.CanvasSource(canvas, { codec: "avc", bitrate, keyFrameInterval: 2 });
    output.addVideoTrack(videoSource, { frameRate: VIDEO_EXPORT_CONFIG.maxFps });
    const audioSource = audioBuffer
      ? new mb.AudioBufferSource({ codec: "aac", bitrate: VIDEO_EXPORT_CONFIG.targetAudioBitrate })
      : null;
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();
    if (audioSource && audioBuffer) {
      await audioSource.add(audioBuffer);
      audioSource.close();
    }

    // La sorgente viene decodificata già ridotta alla risoluzione che serve davvero all'output.
    const scale = Math.min(1, width / rect.w);
    const sinkSize = {
      width: Math.max(2, Math.round(c.source.width * scale)),
      height: Math.max(2, Math.round(c.source.height * scale)),
    };
    const sink = new mb.CanvasSink(video, { ...sinkSize, fit: "fill", poolSize: 2 });
    const step = 1 / VIDEO_EXPORT_CONFIG.maxFps;
    let last = -Infinity;
    for await (const frame of sink.canvases(start, end)) {
      if (signal?.aborted) throw abortError();
      const t = Math.max(0, frame.timestamp - start);
      if (t - last < step - 1e-3 || t >= duration) continue;
      renderComposition(ctx, frame.canvas, c, width, height, assets);
      await videoSource.add(t, Math.min(Math.max(frame.duration, step), duration - t));
      last = t;
      onProgress?.(Math.min(0.95, t / duration));
    }
    if (last < 0) throw new MediaError("Nessun fotogramma nell'intervallo selezionato.");

    const cover = await sink.getCanvas(c.coverTime ?? start);
    let thumbnail: Blob | undefined;
    if (cover) {
      const size = outputSize(rect, VIDEO_EXPORT_CONFIG.thumbnailLongEdge);
      const thumb = canvas2d(size.width, size.height);
      renderComposition(thumb.ctx, cover.canvas, c, size.width, size.height, assets);
      thumbnail = (await toBlob(thumb.canvas, "image/jpeg", 0.8)) ?? undefined;
    }
    canvas.width = canvas.height = 0;

    await output.finalize();
    const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer!;
    const result = new File([buffer], fileName("video/mp4"), { type: "video/mp4" });
    await verifyVideo(result, { width, height, duration, hasAudio: !!audioBuffer });
    onProgress?.(1);
    return {
      file: result,
      type: "video",
      mimeType: "video/mp4",
      width,
      height,
      size: result.size,
      durationSeconds: duration,
      thumbnail,
    };
  } catch (e) {
    if (output && output.state !== "finalized") await output.cancel();
    throw e;
  } finally {
    input.dispose();
  }
}

/** Rilegge l'MP4 prodotto: tracce, codec, dimensioni e durata devono corrispondere alla composizione. */
async function verifyVideo(
  file: File,
  expected: { width: number; height: number; duration: number; hasAudio: boolean }
) {
  const { input } = await openInput(file);
  try {
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    const ok =
      video?.codec === "avc" &&
      video.displayWidth === expected.width &&
      video.displayHeight === expected.height &&
      Math.abs(duration - expected.duration) < 0.5 &&
      (expected.hasAudio ? audio?.codec === "aac" : !audio);
    if (!ok) throw new MediaError("Il video esportato non è valido: riprova o usa un altro browser.");
  } finally {
    input.dispose();
  }
}
