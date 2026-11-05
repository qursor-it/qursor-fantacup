import { describe, expect, it } from "vitest";
import { applyAdjustments, isNeutral } from "./render";
import type { Adjustments } from "./types";

const neutral: Adjustments = { filter: "none", brightness: 0, contrast: 0 };
const px = () => new Uint8ClampedArray([100, 150, 200, 255]);

describe("isNeutral", () => {
  it("vero solo senza filtro ne regolazioni", () => {
    expect(isNeutral(neutral)).toBe(true);
    expect(isNeutral({ ...neutral, filter: "bw" })).toBe(false);
    expect(isNeutral({ ...neutral, brightness: 0.1 })).toBe(false);
    expect(isNeutral({ ...neutral, contrast: -0.1 })).toBe(false);
  });
});

describe("applyAdjustments", () => {
  it("neutro lascia i pixel invariati", () => {
    const d = px();
    applyAdjustments(d, neutral);
    expect(Array.from(d)).toEqual([100, 150, 200, 255]);
  });

  it("bw rende r=g=b", () => {
    const d = px();
    applyAdjustments(d, { ...neutral, filter: "bw" });
    expect(d[0]).toBe(d[1]);
    expect(d[1]).toBe(d[2]);
    expect(d[3]).toBe(255);
  });

  it("la luminosita alza i valori", () => {
    const d = px();
    applyAdjustments(d, { ...neutral, brightness: 0.5 });
    expect(Array.from(d.slice(0, 3))).toEqual([140, 190, 240]);
  });

  it("il contrasto allontana i valori da 128", () => {
    const d = new Uint8ClampedArray([100, 156, 128, 255]);
    applyAdjustments(d, { ...neutral, contrast: 0.5 });
    expect(d[0]).toBeLessThan(100);
    expect(d[1]).toBeGreaterThan(156);
    expect(d[2]).toBe(128);
  });

  it("satura a 0..255", () => {
    const d = new Uint8ClampedArray([250, 5, 128, 255]);
    applyAdjustments(d, { ...neutral, brightness: 1, contrast: 1 });
    expect(d[0]).toBe(255);
    const e = new Uint8ClampedArray([250, 5, 128, 255]);
    applyAdjustments(e, { ...neutral, brightness: -1, contrast: 1 });
    expect(e[1]).toBe(0);
  });
});
