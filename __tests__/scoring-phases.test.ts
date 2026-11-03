import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@prisma/client";

type PhaseRow = { id: number; order: number; closedAt: Date };

const state = vi.hoisted(() => ({
  lastReads: [] as Array<PhaseRow | null>,
  createError: null as unknown,
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    scoringPhase: {
      findFirst: vi.fn(async () => state.lastReads.shift() ?? null),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        if (state.createError) throw state.createError;
        return { id: 99, ...args.data };
      }),
    },
    scoringPhaseScore: { createMany: vi.fn(async () => ({ count: 0 })) },
  };
  const db = {
    scoringPhase: { findFirst: vi.fn(async () => state.lastReads.shift() ?? null) },
    match: { findMany: vi.fn(async () => []) },
    fantasyTeam: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { db };
});

vi.mock("@/lib/scoring", () => ({
  computeFantasyTeamPoints: vi.fn(async () => new Map<number, number>()),
}));
vi.mock("@/lib/domain/mvp", () => ({ resolveMvp: vi.fn() }));
vi.mock("@/lib/audit", () => ({ logAdminAction: vi.fn(async () => {}) }));

import { closeScoringPhase } from "@/lib/scoring-phases";

const conflict = { ok: false, error: "Fase già chiusa da un altro admin, ricarica la pagina." };

beforeEach(() => {
  state.lastReads = [];
  state.createError = null;
});

describe("closeScoringPhase", () => {
  test("aborta se un altro admin ha chiuso la fase durante il calcolo", async () => {
    state.lastReads = [
      { id: 1, order: 1, closedAt: new Date("2026-01-01") },
      { id: 2, order: 2, closedAt: new Date("2026-01-02") },
    ];

    await expect(closeScoringPhase("Gironi", 1)).resolves.toEqual(conflict);
  });

  test("restituisce il messaggio di conflitto sul P2002 di order", async () => {
    state.lastReads = [null, null];
    state.createError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "7.7.0",
      meta: { target: ["order"] },
    });

    await expect(closeScoringPhase("Gironi", 1)).resolves.toEqual(conflict);
  });
});
