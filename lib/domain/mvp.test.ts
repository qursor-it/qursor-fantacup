import { describe, expect, it } from "vitest";
import { MVP_WINDOW_MS } from "./vote";
import { DEFAULT_MVP_POINTS, mvpPointsFromBonusType, resolveMvp } from "./mvp";

describe("resolveMvp", () => {
  const closedAt = new Date(Date.now() - MVP_WINDOW_MS - 60_000);
  const openAt = new Date();

  it("keeps MVP unresolved while the vote window is open", () => {
    expect(
      resolveMvp({
        concludedAt: openAt,
        votes: [{ playerId: 1 }, { playerId: 1 }],
      })
    ).toMatchObject({ status: "open", playerId: null });
  });

  it("resolves a unique winner after the vote window closes", () => {
    expect(
      resolveMvp({
        concludedAt: closedAt,
        votes: [{ playerId: 1 }, { playerId: 2 }, { playerId: 1 }],
      })
    ).toMatchObject({ status: "resolved", playerId: 1, source: "automatic" });
  });

  it("requires an admin decision when final votes are tied", () => {
    expect(
      resolveMvp({
        concludedAt: closedAt,
        votes: [{ playerId: 1 }, { playerId: 2 }],
      })
    ).toMatchObject({ status: "tied", playerId: null, tiedPlayerIds: [1, 2] });
  });

  it("uses a valid admin override after the vote window closes", () => {
    expect(
      resolveMvp({
        concludedAt: closedAt,
        votes: [{ playerId: 1 }, { playerId: 2 }],
        mvpOverridePlayerId: 2,
        eligiblePlayerIds: [1, 2],
      })
    ).toMatchObject({ status: "resolved", playerId: 2, source: "admin" });
  });

  it("does not resolve an MVP when there are no votes", () => {
    expect(resolveMvp({ concludedAt: closedAt, votes: [] })).toMatchObject({
      status: "no_votes",
      playerId: null,
    });
  });
});

describe("resolveMvp eligibility", () => {
  const closedAt = new Date(Date.now() - MVP_WINDOW_MS - 60_000);

  it("ignores votes for players not eligible in the match", () => {
    expect(
      resolveMvp({
        concludedAt: closedAt,
        votes: [{ playerId: 9 }, { playerId: 9 }, { playerId: 1 }],
        eligiblePlayerIds: [1, 2],
      })
    ).toMatchObject({ status: "resolved", playerId: 1, voteCounts: [{ playerId: 1, votes: 1 }] });
  });

  it("returns no_votes when only ineligible votes exist", () => {
    expect(
      resolveMvp({
        concludedAt: closedAt,
        votes: [{ playerId: 9 }],
        eligiblePlayerIds: [1, 2],
      })
    ).toMatchObject({ status: "no_votes" });
  });
});

describe("mvpPointsFromBonusType", () => {
  it("defaults to DEFAULT_MVP_POINTS", () => {
    expect(DEFAULT_MVP_POINTS).toBe(3);
    expect(mvpPointsFromBonusType(null)).toBe(3);
    expect(mvpPointsFromBonusType({ points: "5" })).toBe(5);
  });
});
