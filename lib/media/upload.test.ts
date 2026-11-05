import { afterEach, describe, expect, it, vi } from "vitest";
import { MockMediaUploadService, type MockUploadPayload } from "./upload";
import type { ExportedMedia } from "./types";

const media: ExportedMedia = {
  file: new File(["x"], "a.mp4", { type: "video/mp4" }),
  type: "video",
  mimeType: "video/mp4",
  width: 720,
  height: 1280,
  size: 1234,
  durationSeconds: 12,
};
const result = { id: "mock-1", status: "mocked", filename: "a.mp4", mimeType: "video/mp4", size: 1234, createdAt: "x" };
const okResponse = () => new Response(JSON.stringify(result), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("MockMediaUploadService", () => {
  it("invia solo i metadati in JSON all'endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const res = await new MockMediaUploadService({ simulate: "error", endpoint: "/x" }).upload(media);

    expect(res).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/x");
    expect(init.method).toBe("POST");
    expect(typeof init.body).toBe("string");
    expect(JSON.parse(init.body) as MockUploadPayload).toEqual({
      filename: "a.mp4", mimeType: "video/mp4", size: 1234, type: "video",
      width: 720, height: 1280, durationSeconds: 12, simulate: "error",
    });
  });

  it("usa l'endpoint di default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
    await new MockMediaUploadService().upload(media);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/media/mock-upload");
  });

  it("chiama onProgress con 0 e poi 1", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));
    const onProgress = vi.fn();
    await new MockMediaUploadService().upload(media, onProgress);
    expect(onProgress.mock.calls).toEqual([[0], [1]]);
  });

  it("con risposta non ok lancia con lo status HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    const onProgress = vi.fn();
    await expect(new MockMediaUploadService().upload(media, onProgress)).rejects.toThrow("HTTP 503");
    expect(onProgress).not.toHaveBeenCalledWith(1);
  });

  it("passa il segnale a fetch e propaga AbortError", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal!.reason));
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const p = new MockMediaUploadService().upload(media, undefined, controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});
