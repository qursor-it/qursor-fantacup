import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/session";
import { POST } from "@/app/api/media/mock-upload/route";
import { MOCK_LATENCY_MS, parseMockUploadPayload } from "./mock-upload";

const video = {
  filename: "a.mp4", mimeType: "video/mp4", type: "video", size: 1000, width: 720, height: 1280, durationSeconds: 12,
};
const image = { filename: "a.webp", mimeType: "image/webp", type: "image", size: 1000, width: 720, height: 1280 };
const MAX = 500 * 1024 * 1024;

describe("parseMockUploadPayload", () => {
  it("accetta video e foto validi", () => {
    expect(parseMockUploadPayload(video)).toMatchObject(video);
    expect(parseMockUploadPayload(image)).toMatchObject(image);
    expect(parseMockUploadPayload({ ...image, mimeType: "image/jpeg" })).not.toBeNull();
  });

  it("ignora durationSeconds sulle foto", () => {
    expect(parseMockUploadPayload({ ...image, durationSeconds: 5 })?.durationSeconds).toBeUndefined();
  });

  it("accetta simulate solo 'error'", () => {
    expect(parseMockUploadPayload({ ...image, simulate: "error" })?.simulate).toBe("error");
    expect(parseMockUploadPayload({ ...image, simulate: "boom" })).toBeNull();
  });

  it("rifiuta corpi non oggetto", () => {
    for (const b of [null, undefined, "x", 3]) expect(parseMockUploadPayload(b)).toBeNull();
  });

  it("rifiuta filename vuoto o troppo lungo", () => {
    expect(parseMockUploadPayload({ ...image, filename: "" })).toBeNull();
    expect(parseMockUploadPayload({ ...image, filename: "a".repeat(201) })).toBeNull();
    expect(parseMockUploadPayload({ ...image, filename: 5 })).toBeNull();
  });

  it("rifiuta MIME non ammesso o incoerente con type", () => {
    expect(parseMockUploadPayload({ ...image, mimeType: "image/png" })).toBeNull();
    expect(parseMockUploadPayload({ ...image, mimeType: "toString" })).toBeNull();
    expect(parseMockUploadPayload({ ...image, type: "video" })).toBeNull();
    expect(parseMockUploadPayload({ ...video, type: "image" })).toBeNull();
  });

  it("rifiuta size e dimensioni fuori limite", () => {
    expect(parseMockUploadPayload({ ...image, size: 0 })).toBeNull();
    expect(parseMockUploadPayload({ ...image, size: 1.5 })).toBeNull();
    expect(parseMockUploadPayload({ ...image, size: MAX + 1 })).toBeNull();
    expect(parseMockUploadPayload({ ...image, size: MAX })).not.toBeNull();
    expect(parseMockUploadPayload({ ...image, width: 0 })).toBeNull();
    expect(parseMockUploadPayload({ ...image, width: 4097 })).toBeNull();
    expect(parseMockUploadPayload({ ...image, height: 10.5 })).toBeNull();
  });

  it("richiede una durata valida per i video", () => {
    const noDuration: Record<string, unknown> = { ...video };
    delete noDuration.durationSeconds;
    expect(parseMockUploadPayload(noDuration)).toBeNull();
    expect(parseMockUploadPayload({ ...video, durationSeconds: 0 })).toBeNull();
    expect(parseMockUploadPayload({ ...video, durationSeconds: 61.5 })).toBeNull();
    expect(parseMockUploadPayload({ ...video, durationSeconds: 61 })).not.toBeNull();
    expect(parseMockUploadPayload({ ...video, durationSeconds: "12" })).toBeNull();
  });
});

describe("POST /api/media/mock-upload", () => {
  type User = Awaited<ReturnType<typeof getCurrentUser>>;
  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/media/mock-upload", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    );
  // Avanza il timer della latenza simulata.
  const run = async (body: unknown) => {
    const p = post(body);
    await vi.advanceTimersByTimeAsync(MOCK_LATENCY_MS);
    return p;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "u1" } as User);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("401 se non autenticato", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await post(image);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("400 con JSON non valido o payload non valido", async () => {
    for (const body of ["{not json", { ...image, size: 0 }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "invalid_payload" });
    }
  });

  it("200 con il risultato simulato", async () => {
    const res = await run(video);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json();
    expect(json.id).toMatch(/^mock-/);
    expect(json).toMatchObject({ status: "mocked", filename: "a.mp4", mimeType: "video/mp4", size: 1000 });
    expect(Number.isNaN(Date.parse(json.createdAt))).toBe(false);
  });

  it("503 con simulate error", async () => {
    const res = await run({ ...image, simulate: "error" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "mock_failure" });
  });

  it("429 oltre il limite per utente", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "flood" } as User);
    let res: Response | undefined;
    for (let i = 0; i < 21; i++) res = await post("{bad");
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).not.toBeNull();
  });
});
