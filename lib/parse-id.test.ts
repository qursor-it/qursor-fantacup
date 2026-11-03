import { describe, expect, test } from "vitest";
import { parseId } from "./parse-id";

describe("parseId", () => {
  test("accetta un intero positivo valido", () => {
    expect(parseId("5")).toBe(5);
  });

  test("rifiuta formati non interi o ambigui", () => {
    expect(parseId("5.")).toBeNull();
    expect(parseId("5.0")).toBeNull();
    expect(parseId("05")).toBeNull();
    expect(parseId("-1")).toBeNull();
    expect(parseId("0")).toBeNull();
    expect(parseId("")).toBeNull();
    expect(parseId("abc")).toBeNull();
  });

  test("rifiuta valori oltre il limite di Postgres int", () => {
    expect(parseId("2147483648")).toBeNull();
  });

  test("rifiuta valori assenti", () => {
    expect(parseId(undefined)).toBeNull();
    expect(parseId(null)).toBeNull();
  });
});
