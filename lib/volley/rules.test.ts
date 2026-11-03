import { describe, expect, it } from "vitest";
import {
  canMutateVolleySets,
  nextVolleySetNumber,
  volleySetMutationError,
  VOLLEY_SET_LOCKED_MSG,
} from "./rules";

describe("volleySetMutationError", () => {
  it("blocks mutations on a concluded match", () => {
    expect(volleySetMutationError("CONCLUDED")).toBe(VOLLEY_SET_LOCKED_MSG);
    expect(canMutateVolleySets("CONCLUDED")).toBe(false);
  });

  it("allows mutations on draft and scheduled matches", () => {
    expect(volleySetMutationError("DRAFT")).toBeNull();
    expect(volleySetMutationError("SCHEDULED")).toBeNull();
    expect(canMutateVolleySets("SCHEDULED")).toBe(true);
  });
});

describe("nextVolleySetNumber", () => {
  it("starts from 1 and follows the highest existing set", () => {
    expect(nextVolleySetNumber([])).toBe(1);
    expect(nextVolleySetNumber([{ setNumber: 1 }, { setNumber: 2 }])).toBe(3);
  });

  it("returns null once the match already has five sets", () => {
    expect(
      nextVolleySetNumber([1, 2, 3, 4, 5].map((setNumber) => ({ setNumber })))
    ).toBeNull();
  });
});
