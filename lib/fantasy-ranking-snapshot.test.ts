import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isSnapshotStale } from "./fantasy-ranking-snapshot";

const NOW = new Date("2026-03-01T12:00:00Z");
const COMPUTED_AT = new Date(NOW.getTime() - 3 * 60 * 60 * 1000);
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

function snapshotInput(overrides: Partial<Parameters<typeof isSnapshotStale>[0]> = {}) {
  return {
    computedAt: COMPUTED_AT,
    snapshotTeamCount: 2,
    teamCount: 2,
    mvpWindowsClosedAt: [],
    now: NOW,
    ...overrides,
  };
}

describe("isSnapshotStale", () => {
  it("non è stale quando squadre e finestre MVP coincidono con la snapshot", () => {
    expect(isSnapshotStale(snapshotInput())).toBe(false);
  });

  it("è stale quando il numero di squadre è cambiato", () => {
    expect(isSnapshotStale(snapshotInput({ snapshotTeamCount: 2, teamCount: 3 }))).toBe(true);
  });

  it("è stale quando una finestra MVP si è chiusa dopo computedAt", () => {
    // computedAt = now - 3h, finestra chiusa a now - 1h.
    expect(isSnapshotStale(snapshotInput({ mvpWindowsClosedAt: [at(-60 * 60 * 1000)] }))).toBe(true);
  });

  it("non è stale quando la finestra MVP si è chiusa prima di computedAt", () => {
    // computedAt = now - 3h, finestra chiusa a now - 4h.
    expect(isSnapshotStale(snapshotInput({ mvpWindowsClosedAt: [at(-4 * 60 * 60 * 1000)] }))).toBe(false);
  });

  it("non è stale quando la finestra chiude esattamente a computedAt", () => {
    expect(isSnapshotStale(snapshotInput({ mvpWindowsClosedAt: [COMPUTED_AT] }))).toBe(false);
  });

  it("non è stale quando la finestra non è ancora chiusa a now", () => {
    expect(isSnapshotStale(snapshotInput({ mvpWindowsClosedAt: [at(60 * 60 * 1000)] }))).toBe(false);
  });

  it("considera chiusa a now una finestra che chiude esattamente ora", () => {
    expect(isSnapshotStale(snapshotInput({ mvpWindowsClosedAt: [NOW] }))).toBe(true);
  });

  it("basta una finestra chiusa dopo computedAt in un elenco più ampio", () => {
    expect(
      isSnapshotStale(
        snapshotInput({
          mvpWindowsClosedAt: [
            at(-5 * 60 * 60 * 1000),
            at(-30 * 60 * 1000),
            at(30 * 60 * 1000),
          ],
        })
      )
    ).toBe(true);
  });
});
