import { describe, expect, it } from "vitest";
import { aspectValue, cropRect, outputSize, panBy, rotatedSize, toLocal } from "./geometry";
import type { MediaComposition } from "./types";

type C = Pick<MediaComposition, "source" | "rotation" | "aspectRatio" | "crop">;
const base = (over: Partial<C> = {}): C => ({
  source: { width: 1600, height: 900 },
  rotation: 0,
  aspectRatio: "9:16",
  crop: { zoom: 1, panX: 0, panY: 0 },
  ...over,
});

describe("aspectValue", () => {
  it("restituisce i rapporti fissi e quello della sorgente per original", () => {
    expect(aspectValue("1:1", 100, 50)).toBe(1);
    expect(aspectValue("4:5", 100, 50)).toBe(0.8);
    expect(aspectValue("9:16", 100, 50)).toBe(9 / 16);
    expect(aspectValue("original", 100, 50)).toBe(2);
  });
});

describe("rotatedSize", () => {
  it("scambia le dimensioni a 90 e 270 gradi", () => {
    expect(rotatedSize(10, 20, 0)).toEqual({ width: 10, height: 20 });
    expect(rotatedSize(10, 20, 90)).toEqual({ width: 20, height: 10 });
    expect(rotatedSize(10, 20, 180)).toEqual({ width: 10, height: 20 });
    expect(rotatedSize(10, 20, 270)).toEqual({ width: 20, height: 10 });
  });
});

describe("cropRect", () => {
  it("ritaglia al centro una sorgente orizzontale in 9:16", () => {
    const r = cropRect(base());
    expect(r.h).toBe(900);
    expect(r.w).toBeCloseTo(506.25);
    expect(r.x).toBeCloseTo((1600 - 506.25) / 2);
    expect(r.y).toBe(0);
  });

  it("con pan -1 e 1 arriva ai bordi", () => {
    const left = cropRect(base({ crop: { zoom: 1, panX: -1, panY: 0 } }));
    const right = cropRect(base({ crop: { zoom: 1, panX: 1, panY: 0 } }));
    expect(left.x).toBeCloseTo(0);
    expect(right.x + right.w).toBeCloseTo(1600);
  });

  it("zoom 2 dimezza il ritaglio", () => {
    const r = cropRect(base({ crop: { zoom: 2, panX: 0, panY: 0 } }));
    expect(r.h).toBeCloseTo(450);
    expect(r.w).toBeCloseTo(253.125);
  });

  it("la rotazione di 90 gradi scambia le dimensioni della sorgente", () => {
    const r = cropRect(base({ rotation: 90, aspectRatio: "original" }));
    expect(r).toEqual({ x: 0, y: 0, w: 900, h: 1600 });
  });

  it("original usa tutto il fotogramma", () => {
    expect(cropRect(base({ aspectRatio: "original" }))).toEqual({ x: 0, y: 0, w: 1600, h: 900 });
  });
});

describe("outputSize", () => {
  it("limita il lato lungo senza ingrandire", () => {
    expect(outputSize({ w: 4000, h: 2000 }, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(outputSize({ w: 800, h: 600 }, 2000)).toEqual({ width: 800, height: 600 });
  });

  it("per i video usa dimensioni pari, minimo 2", () => {
    expect(outputSize({ w: 501, h: 889 }, 1920, true)).toEqual({ width: 500, height: 888 });
    expect(outputSize({ w: 1, h: 1 }, 1920, true)).toEqual({ width: 2, height: 2 });
  });

  it("per le foto il minimo e 1", () => {
    expect(outputSize({ w: 0.2, h: 0.2 }, 2000)).toEqual({ width: 1, height: 1 });
  });
});

describe("toLocal", () => {
  it("senza rotazione sottrae il centro", () => {
    expect(toLocal(15, 25, 10, 20, 0)).toEqual({ x: 5, y: 5 });
  });

  it("applica la rotazione inversa", () => {
    const p = toLocal(10, 20 + 5, 10, 20, Math.PI / 2);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(0);
  });
});

describe("panBy", () => {
  it("trascinare a destra diminuisce panX", () => {
    expect(panBy(base(), 10, 0, 300).panX).toBeLessThan(0);
  });

  it("limita il pan a [-1, 1]", () => {
    expect(panBy(base(), 100000, 0, 300).panX).toBe(-1);
    expect(panBy(base(), -100000, 0, 300).panX).toBe(1);
  });

  it("senza margine il pan resta 0", () => {
    // Il ritaglio 9:16 usa gia tutta l'altezza.
    expect(panBy(base(), 0, 50, 300).panY).toBe(0);
  });
});
