import { describe, expect, it } from "vitest";
import { clampMusicStart, copyInto, findTrack, MUSIC_CATALOG, musicCoverage } from "./music";

describe("clampMusicStart", () => {
  it("lascia invariato un valore valido", () => {
    expect(clampMusicStart(10, 90, 30)).toBe(10);
  });

  it("limita a fine brano meno la clip e a zero", () => {
    expect(clampMusicStart(80, 90, 30)).toBe(60);
    expect(clampMusicStart(-3, 90, 30)).toBe(0);
  });

  it("brano piu corto della clip: parte da 0", () => {
    expect(clampMusicStart(5, 20, 30)).toBe(0);
  });
});

describe("musicCoverage", () => {
  it("copre tutta la clip", () => {
    expect(musicCoverage(10, 90, 30)).toBe(30);
  });

  it("copertura parziale", () => {
    expect(musicCoverage(10, 20, 30)).toBe(10);
  });

  it("inizio oltre il brano: nessuna copertura", () => {
    expect(musicCoverage(100, 90, 30)).toBe(0);
  });
});

describe("copyInto", () => {
  const src = Float32Array.from([1, 2, 3, 4]);

  it("offset positivo", () => {
    const t = new Float32Array(6);
    copyInto(t, src, 2);
    expect(Array.from(t)).toEqual([0, 0, 1, 2, 3, 4]);
  });

  it("offset negativo salta l'inizio della sorgente", () => {
    const t = new Float32Array(3);
    copyInto(t, src, -2);
    expect(Array.from(t)).toEqual([3, 4, 0]);
  });

  it("tronca cio che eccede il target", () => {
    const t = new Float32Array(3);
    copyInto(t, src, 1);
    expect(Array.from(t)).toEqual([0, 1, 2]);
  });

  it("completamente fuori non fa nulla", () => {
    const t = new Float32Array(3);
    copyInto(t, src, 3);
    copyInto(t, src, -4);
    expect(Array.from(t)).toEqual([0, 0, 0]);
  });
});

describe("MUSIC_CATALOG", () => {
  it("ha id univoci", () => {
    const ids = MUSIC_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findTrack trova per id", () => {
    expect(findTrack(MUSIC_CATALOG[0].id)).toBe(MUSIC_CATALOG[0]);
    expect(findTrack("nope")).toBeUndefined();
  });
});
