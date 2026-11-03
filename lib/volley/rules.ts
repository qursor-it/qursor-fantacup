import type { VolleyMatchStatus } from "@prisma/client";

export const VOLLEY_MAX_SETS = 5;

export const VOLLEY_SET_LOCKED_MSG =
  "La partita è conclusa: riaprila prima di modificare i set.";

/** I set si possono modificare solo finché la partita non è conclusa. */
export function volleySetMutationError(status: VolleyMatchStatus): string | null {
  return status === "CONCLUDED" ? VOLLEY_SET_LOCKED_MSG : null;
}

export function canMutateVolleySets(status: VolleyMatchStatus): boolean {
  return volleySetMutationError(status) === null;
}

/** Prossimo numero di set, oppure null se la partita ha già il massimo. */
export function nextVolleySetNumber(existing: { setNumber: number }[]): number | null {
  if (existing.length >= VOLLEY_MAX_SETS) return null;
  return existing.reduce((max, set) => Math.max(max, set.setNumber), 0) + 1;
}
