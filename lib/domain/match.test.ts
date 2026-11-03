import { describe, expect, it } from "vitest";
import {
  formatMatchDateInputValue,
  formatMatchTimeInputValue,
  getMatchClockNow,
  isScheduledMatchInProgress,
  LIVE_MATCH_WINDOW_MS,
  parseMatchDateTimeInput,
  resolveMatchScore,
} from "./match";

const now = new Date("2026-06-15T18:00:00.000Z");

describe("isScheduledMatchInProgress", () => {
  it("returns true for a scheduled match that has already started", () => {
    expect(
      isScheduledMatchInProgress({
        status: "SCHEDULED",
        startsAt: new Date(now.getTime() - 30 * 60 * 1000),
        now,
      })
    ).toBe(true);
  });

  it("returns true exactly at the live window cutoff", () => {
    expect(
      isScheduledMatchInProgress({
        status: "SCHEDULED",
        startsAt: new Date(now.getTime() - LIVE_MATCH_WINDOW_MS),
        now,
      })
    ).toBe(true);
  });

  it("returns false for scheduled matches before kickoff", () => {
    expect(
      isScheduledMatchInProgress({
        status: "SCHEDULED",
        startsAt: new Date(now.getTime() + 1),
        now,
      })
    ).toBe(false);
  });

  it("returns false for scheduled matches after the live window", () => {
    expect(
      isScheduledMatchInProgress({
        status: "SCHEDULED",
        startsAt: new Date(now.getTime() - LIVE_MATCH_WINDOW_MS - 1),
        now,
      })
    ).toBe(false);
  });

  it("does not treat LIVE as an active source of truth", () => {
    expect(
      isScheduledMatchInProgress({
        status: "LIVE",
        startsAt: new Date(now.getTime() - 30 * 60 * 1000),
        now,
      })
    ).toBe(false);
  });
});

describe("match date/time input helpers", () => {
  it("formats match inputs from UTC values without applying local timezone offset", () => {
    const startsAt = new Date("2026-06-15T13:40:00.000Z");

    expect(formatMatchDateInputValue(startsAt)).toBe("2026-06-15");
    expect(formatMatchTimeInputValue(startsAt)).toBe("13:40");
  });

  it("parses match inputs as UTC wall-clock values", () => {
    expect(parseMatchDateTimeInput("2026-06-15", "13:40").toISOString()).toBe(
      "2026-06-15T13:40:00.000Z"
    );
  });
});

describe("resolveMatchScore", () => {
  const stored = { homeScore: 2, awayScore: 1 };

  it("keeps the stored score when the fields are absent", () => {
    expect(resolveMatchScore({}, stored)).toEqual(stored);
  });

  it("uses the submitted score when the fields are present", () => {
    expect(resolveMatchScore({ homeScore: 0, awayScore: 3 }, stored)).toEqual({
      homeScore: 0,
      awayScore: 3,
    });
  });

  it("uses submitted null to clear a score, while keeping the absent side", () => {
    expect(resolveMatchScore({ homeScore: null }, stored)).toEqual({
      homeScore: null,
      awayScore: 1,
    });
  });
});

describe("getMatchClockNow", () => {
  it("converts the real instant to the tournament wall-clock stored as UTC", () => {
    expect(getMatchClockNow(new Date("2026-06-15T11:40:00.000Z")).toISOString()).toBe(
      "2026-06-15T13:40:00.000Z"
    );
  });
});
