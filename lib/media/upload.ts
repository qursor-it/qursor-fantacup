import type { ExportedMedia } from "./types";

export interface MediaUploadResult {
  id: string;
  status: "mocked";
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

/** Contratto usato dal Media Composer: un servizio reale (es. URL firmato verso Quarkus) lo implementerà allo stesso modo. */
export interface MediaUploadService {
  upload(
    media: ExportedMedia,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<MediaUploadResult>;
}

/** Metadati inviati all'endpoint mock: il file non lascia mai il dispositivo. */
export interface MockUploadPayload {
  filename: string;
  mimeType: string;
  size: number;
  type: ExportedMedia["type"];
  width: number;
  height: number;
  durationSeconds?: number;
  simulate?: "error";
}

/**
 * Invio simulato: manda solo i metadati a POST /api/media/mock-upload, che risponde dopo una breve attesa.
 * Il progresso è solo "iniziato/finito": non misura byte trasferiti.
 */
export class MockMediaUploadService implements MediaUploadService {
  constructor(private readonly options: { simulate?: "error"; endpoint?: string } = {}) {}

  async upload(media: ExportedMedia, onProgress?: (progress: number) => void, signal?: AbortSignal) {
    const payload: MockUploadPayload = {
      filename: media.file.name,
      mimeType: media.mimeType,
      size: media.size,
      type: media.type,
      width: media.width,
      height: media.height,
      durationSeconds: media.durationSeconds,
      simulate: this.options.simulate,
    };
    onProgress?.(0);
    const res = await fetch(this.options.endpoint ?? "/api/media/mock-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error(`Pubblicazione simulata non riuscita (HTTP ${res.status}).`);
    const result = (await res.json()) as MediaUploadResult;
    onProgress?.(1);
    return result;
  }
}
