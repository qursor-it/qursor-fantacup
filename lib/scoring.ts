import { db } from "./db";
import { MatchStatus } from "@prisma/client";
import { getOfficialMvpPlayerId, mvpPointsFromBonusType } from "./domain/mvp";
import { measureServerTiming } from "./perf";

export type PlayerMatchScore = {
  playerId: number;
  playerName: string;
  footballTeamName: string;
  played: boolean;
  goalPoints: number;
  bonusPoints: number;
  bonusDetails: Array<{
    code: string;
    name: string;
    quantity: number;
    points: number;
  }>;
  isMvp: boolean;
  mvpPoints: number;
  basePoints: number;
  isCaptain: boolean;
  finalPoints: number; // basePoints * (isCaptain ? 2 : 1)
};

export type MatchScore = {
  matchId: number;
  label: string; // "HomeTeam vs AwayTeam"
  startsAt: Date;
  concludedAt: Date | null;
  playerScores: PlayerMatchScore[];
  total: number;
  beforeRegistration: boolean; // true se la partita è stata conclusa prima della creazione della squadra
};

export type RankEntry = {
  rank: number;
  fantasyTeamId: number;
  fantasyTeamName: string;
  userId: number;
  userName: string | null;
  totalPoints: number;
};

/** Arrotonda i punti a 2 decimali (evita errori di virgola mobile nelle somme). */
export function roundPoints(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeMvpWinnerId(votes: Array<{ playerId: number }>): number | null {
  if (!votes.length) return null;

  const counts = new Map<number, number>();
  for (const vote of votes) {
    counts.set(vote.playerId, (counts.get(vote.playerId) ?? 0) + 1);
  }

  const sortedEntries = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0]
  );
  const topEntry = sortedEntries[0];
  const tied = sortedEntries[1] && sortedEntries[1][1] === topEntry[1];

  return tied ? null : topEntry[0];
}

export function accumulatePlayerTotals(
  matches: Array<{
    bonuses: Array<{
      playerId: number;
      points: number | string | { toString(): string };
    }>;
    goals: Array<{ scorerId: number; isOwnGoal: boolean }>;
    votes: Array<{ playerId: number }>;
    concludedAt: Date | null;
    mvpOverridePlayerId?: number | null;
    players?: Array<{ playerId: number }>;
  }>,
  mvpBonus: number
): Map<number, number> {
  const totals = new Map<number, number>();

  for (const match of matches) {
    const mvpId = getOfficialMvpPlayerId({
      concludedAt: match.concludedAt,
      votes: match.votes,
      mvpOverridePlayerId: match.mvpOverridePlayerId,
      eligiblePlayerIds: match.players?.map((player) => player.playerId),
    });

    for (const bonus of match.bonuses) {
      totals.set(
        bonus.playerId,
        (totals.get(bonus.playerId) ?? 0) + Number(bonus.points)
      );
    }

    if (mvpId !== null) {
      totals.set(mvpId, (totals.get(mvpId) ?? 0) + mvpBonus);
    }
  }

  return totals;
}

export type FantasyTeamMeta = {
  id: number;
  name: string;
  captainPlayerId: number;
  players: { playerId: number }[];
  user: { id: number; name: string | null };
};

/**
 * Punti di una squadra dati i totali per giocatore. Il capitano raddoppia:
 * i suoi punti vengono contati nella rosa e poi sommati una seconda volta.
 */
export function teamPointsFromPlayerTotals(
  team: { captainPlayerId: number; players: { playerId: number }[] },
  playerTotals: Map<number, number>
): number {
  const rosterTotal = team.players.reduce((sum, { playerId }) => sum + (playerTotals.get(playerId) ?? 0), 0);
  const captainTotal = playerTotals.get(team.captainPlayerId) ?? 0;
  return roundPoints(rosterTotal + captainTotal);
}

/**
 * Punti di una squadra contando solo le partite concluse dalla sua createdAt in poi.
 * Le partite con concludedAt < team.createdAt vengono ignorate.
 */
export function teamPointsWithStartDate(
  team: { createdAt: Date; captainPlayerId: number; players: { playerId: number }[] },
  matchContribs: Array<{ concludedAt: Date | null; points: Map<number, number> }>
): number {
  const totals = new Map<number, number>();
  for (const m of matchContribs) {
    if (m.concludedAt && m.concludedAt < team.createdAt) continue;
    for (const [pid, pts] of m.points) totals.set(pid, (totals.get(pid) ?? 0) + pts);
  }
  return teamPointsFromPlayerTotals(team, totals);
}

/** Somma i punti delle fasi congelate (una riga per fase/squadra) con la fase in corso. */
export function combinePhasePoints(
  frozen: Array<{ fantasyTeamId: number; points: number }>,
  current: Map<number, number>
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const row of frozen) {
    totals.set(row.fantasyTeamId, (totals.get(row.fantasyTeamId) ?? 0) + row.points);
  }
  for (const [teamId, pts] of current) {
    totals.set(teamId, (totals.get(teamId) ?? 0) + pts);
  }
  for (const [teamId, pts] of totals) totals.set(teamId, roundPoints(pts));
  return totals;
}

/**
 * Punti fanta per squadra (rosa attuale) sulle partite CONCLUDED nella finestra
 * temporale data — `from`/`to` filtrano per `concludedAt` (>= from, < to).
 * Senza opzioni = tutte le partite concluse.
 *
 * Semantica dei confini: una fase congelata usa `concludedAt < closedAt`, la fase
 * successiva/in corso usa `concludedAt >= closedAt`. Una partita conclusa esattamente
 * all'istante dello snapshot conta una sola volta (nella fase in corso), mai due volte
 * né persa. Ogni partita CONCLUDED ha sempre `concludedAt` valorizzato (vedi conclude
 * match), quindi nessuna partita viene esclusa dal filtro.
 */
export async function computeFantasyTeamPoints(opts?: {
  from?: Date | null;
  to?: Date | null;
}): Promise<Map<number, number>> {
  return measureServerTiming("scoring.computeFantasyTeamPoints", async () => {
    const concludedAt: { gte?: Date; lt?: Date } = {};
    if (opts?.from) concludedAt.gte = opts.from;
    if (opts?.to) concludedAt.lt = opts.to;

    const [matches, fantasyTeams, mvpBonus] = await Promise.all([
      db.match.findMany({
        where: {
          status: MatchStatus.CONCLUDED,
          ...(opts?.from || opts?.to ? { concludedAt } : {}),
        },
        select: {
          concludedAt: true,
          mvpOverridePlayerId: true,
          players: { select: { playerId: true } },
          bonuses: { where: { bonusType: { code: { not: "MVP" } } }, select: { playerId: true, points: true } },
          goals: { select: { scorerId: true, isOwnGoal: true } },
          votes: { select: { playerId: true } },
        },
      }),
      db.fantasyTeam.findMany({
        select: { id: true, createdAt: true, captainPlayerId: true, players: { select: { playerId: true } } },
      }),
      getMvpBonus(),
    ]);

    // Build per-match contribution maps so each team can filter by its own createdAt
    const matchContribs = matches.map((m) => ({
      concludedAt: m.concludedAt,
      points: accumulatePlayerTotals([m], mvpBonus),
    }));

    const result = new Map<number, number>();
    for (const ft of fantasyTeams) {
      result.set(ft.id, teamPointsWithStartDate(ft, matchContribs));
    }
    return result;
  });
}

async function getMvpBonus(): Promise<number> {
  const mvpBonusType = await db.bonusType.findFirst({ where: { code: "MVP" }, select: { points: true } });
  return mvpPointsFromBonusType(mvpBonusType);
}

async function getFantasyTeamMeta(): Promise<FantasyTeamMeta[]> {
  return db.fantasyTeam.findMany({
    select: {
      id: true,
      name: true,
      captainPlayerId: true,
      players: { select: { playerId: true } },
      user: { select: { id: true, name: true } },
    },
  });
}

export function rankFromPoints(teams: FantasyTeamMeta[], points: Map<number, number>): RankEntry[] {
  const entries: Omit<RankEntry, "rank">[] = teams.map((ft) => ({
    fantasyTeamId: ft.id,
    fantasyTeamName: ft.name,
    userId: ft.user.id,
    userName: ft.user.name,
    totalPoints: roundPoints(points.get(ft.id) ?? 0),
  }));

  entries.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      a.fantasyTeamName.localeCompare(b.fantasyTeamName, "it")
  );

  // Standard competition ranking: a parita di punti stesso rank (1, 1, 3).
  let previousPoints: number | null = null;
  let previousRank = 0;
  return entries.map((e, i) => {
    const rank = previousPoints !== null && e.totalPoints === previousPoints ? previousRank : i + 1;
    previousPoints = e.totalPoints;
    previousRank = rank;
    return { ...e, rank };
  });
}

/** Compute total ranking across all CONCLUDED matches (rosa attuale, tutte le partite). */
export async function computeRankings(): Promise<RankEntry[]> {
  return measureServerTiming("scoring.computeRankings", async () => {
    const [teams, points] = await Promise.all([getFantasyTeamMeta(), computeFantasyTeamPoints()]);
    return rankFromPoints(teams, points);
  });
}

/** Ultima fase chiusa (per il confine della fase in corso). */
export async function getLastClosedAt(): Promise<Date | null> {
  const last = await db.scoringPhase.findFirst({
    orderBy: { order: "desc" },
    select: { closedAt: true },
  });
  return last?.closedAt ?? null;
}

/** Classifica generale: somma delle fasi congelate + fase in corso (live). */
export async function computeCumulativeRankings(): Promise<RankEntry[]> {
  return measureServerTiming("scoring.computeCumulativeRankings", async () => {
    const [teams, frozenRows, lastClosedAt] = await Promise.all([
      getFantasyTeamMeta(),
      db.scoringPhaseScore.findMany({ select: { fantasyTeamId: true, points: true } }),
      getLastClosedAt(),
    ]);

    const current = await computeFantasyTeamPoints({ from: lastClosedAt });

    const totals = combinePhasePoints(
      frozenRows.map((row) => ({ fantasyTeamId: row.fantasyTeamId, points: Number(row.points) })),
      current
    );

    return rankFromPoints(teams, totals);
  });
}

/** Classifica di una fase congelata. */
export async function computePhaseRankings(phaseId: number): Promise<RankEntry[]> {
  return measureServerTiming("scoring.computePhaseRankings", async () => {
    const [teams, rows] = await Promise.all([
      getFantasyTeamMeta(),
      db.scoringPhaseScore.findMany({ where: { phaseId }, select: { fantasyTeamId: true, points: true } }),
    ]);
    const points = new Map<number, number>();
    for (const row of rows) points.set(row.fantasyTeamId, Number(row.points));
    return rankFromPoints(teams, points);
  });
}

/** Classifica della fase in corso (live, dalla chiusura dell'ultima fase). */
export async function computeCurrentPhaseRankings(): Promise<RankEntry[]> {
  return measureServerTiming("scoring.computeCurrentPhaseRankings", async () => {
    const lastClosedAt = await getLastClosedAt();
    const [teams, points] = await Promise.all([
      getFantasyTeamMeta(),
      computeFantasyTeamPoints({ from: lastClosedAt }),
    ]);
    return rankFromPoints(teams, points);
  });
}

export type PhaseBreakdownEntry = {
  phaseId: number | null; // null = fase in corso
  name: string;
  points: number;
  current: boolean;
};

/** Punti per fase di una singola squadra (fasi congelate + fase in corso). */
export async function getTeamPhaseBreakdown(fantasyTeamId: number): Promise<PhaseBreakdownEntry[]> {
  const [phases, lastClosedAt] = await Promise.all([
    db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, scores: { where: { fantasyTeamId }, select: { points: true } } },
    }),
    getLastClosedAt(),
  ]);

  const result: PhaseBreakdownEntry[] = phases.map((p) => ({
    phaseId: p.id,
    name: p.name,
    points: p.scores[0] ? Number(p.scores[0].points) : 0,
    current: false,
  }));

  const current = await computeFantasyTeamPoints({ from: lastClosedAt });
  result.push({
    phaseId: null,
    name: "Fase in corso",
    points: current.get(fantasyTeamId) ?? 0,
    current: true,
  });

  return result;
}

export type PhaseRosterWindow = {
  startsAt: Date | null; // confine inferiore (incluso); null = nessun limite
  closedAt: Date | null; // confine superiore (escluso); null = fase in corso (nessun limite)
  rosterPlayerIds: number[];
  captainPlayerId: number | null; // null = la squadra non aveva ancora uno score per questa fase
};

/**
 * Finestre rosa per fase: ogni fase congelata usa la rosa che aveva al momento
 * dello snapshot (rosterPlayerIds/captainPlayerId di ScoringPhaseScore). Se la
 * squadra non esisteva ancora (nessuno score per quella fase) la rosa è vuota,
 * coerente con i punti a 0 restituiti da getTeamPhaseBreakdown per quella fase.
 * L'ultima finestra (fase in corso) è sempre aperta e usa la rosa attuale.
 */
export function buildPhaseRosterWindows(
  phases: Array<{
    startsAt: Date | null;
    closedAt: Date;
    score: { rosterPlayerIds: number[]; captainPlayerId: number } | null;
  }>,
  currentRoster: { rosterPlayerIds: number[]; captainPlayerId: number }
): PhaseRosterWindow[] {
  const windows: PhaseRosterWindow[] = phases.map((phase) => ({
    startsAt: phase.startsAt,
    closedAt: phase.closedAt,
    rosterPlayerIds: phase.score?.rosterPlayerIds ?? [],
    captainPlayerId: phase.score?.captainPlayerId ?? null,
  }));
  windows.push({
    startsAt: phases.length > 0 ? phases[phases.length - 1].closedAt : null,
    closedAt: null,
    rosterPlayerIds: currentRoster.rosterPlayerIds,
    captainPlayerId: currentRoster.captainPlayerId,
  });
  return windows;
}

/** Trova la finestra rosa a cui appartiene una partita conclusa, in base a concludedAt. */
export function findRosterWindow(windows: PhaseRosterWindow[], concludedAt: Date | null): PhaseRosterWindow {
  const at = concludedAt ?? new Date(0);
  for (const window of windows) {
    if (window.startsAt && at < window.startsAt) continue;
    if (window.closedAt && at >= window.closedAt) continue;
    return window;
  }
  return windows[windows.length - 1];
}

/**
 * Compute per-match score history for a single fantasy team, phase-aware: ogni
 * partita usa la rosa congelata della fase a cui appartiene (in base a
 * concludedAt), così la somma dei `total` per partita coincide con il totale
 * cumulativo di getTeamPhaseBreakdown anche dopo un cambio rosa. Le partite
 * della fase in corso usano la rosa attuale.
 */
export async function computeTeamHistory(fantasyTeamId: number): Promise<MatchScore[]> {
  const [ft, phases, matches, mvpBonusType] = await Promise.all([
    db.fantasyTeam.findUnique({
      where: { id: fantasyTeamId },
      select: {
        createdAt: true,
        captainPlayerId: true,
        players: { select: { playerId: true } },
      },
    }),
    db.scoringPhase.findMany({
      orderBy: { order: "asc" },
      select: {
        startsAt: true,
        closedAt: true,
        scores: {
          where: { fantasyTeamId },
          select: { rosterPlayerIds: true, captainPlayerId: true },
        },
      },
    }),
    db.match.findMany({
      where: { status: MatchStatus.CONCLUDED },
      select: {
        id: true,
        startsAt: true,
        homeSeed: true,
        awaySeed: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        players: { select: { playerId: true } },
        concludedAt: true,
        mvpOverridePlayerId: true,
        bonuses: {
          where: { bonusType: { code: { not: "MVP" } } },
          select: {
            playerId: true,
            quantity: true,
            points: true,
            bonusType: { select: { code: true, name: true } },
          },
        },
        goals: { select: { scorerId: true, isOwnGoal: true } },
        votes: { select: { playerId: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.bonusType.findFirst({ where: { code: "MVP" }, select: { points: true } }),
  ]);

  if (!ft) return [];

  const mvpBonus = mvpPointsFromBonusType(mvpBonusType);

  const windows = buildPhaseRosterWindows(
    phases.map((phase) => ({
      startsAt: phase.startsAt,
      closedAt: phase.closedAt,
      score: phase.scores[0]
        ? {
            rosterPlayerIds: phase.scores[0].rosterPlayerIds as unknown as number[],
            captainPlayerId: phase.scores[0].captainPlayerId,
          }
        : null,
    })),
    { rosterPlayerIds: ft.players.map((p) => p.playerId), captainPlayerId: ft.captainPlayerId }
  );

  const allPlayerIds = new Set<number>();
  for (const window of windows) for (const id of window.rosterPlayerIds) allPlayerIds.add(id);

  const playerMetas = await db.player.findMany({
    where: { id: { in: [...allPlayerIds] } },
    select: { id: true, name: true, footballTeam: { select: { name: true } } },
  });
  const playerMetaById = new Map(playerMetas.map((p) => [p.id, p]));

  return matches.map((match) => {
    const playerPoints = accumulatePlayerTotals(
      [{
        bonuses: match.bonuses,
        goals: match.goals,
        votes: match.votes,
        concludedAt: match.concludedAt,
        mvpOverridePlayerId: match.mvpOverridePlayerId,
        players: match.players,
      }],
      mvpBonus
    );
    const mvpId = getOfficialMvpPlayerId({
      concludedAt: match.concludedAt,
      votes: match.votes,
      mvpOverridePlayerId: match.mvpOverridePlayerId,
      eligiblePlayerIds: match.players.map((p) => p.playerId),
    });
    const playedPlayerIds = new Set(match.players.map((p) => p.playerId));
    const window = findRosterWindow(windows, match.concludedAt);

    const beforeRegistration = !!match.concludedAt && match.concludedAt < ft.createdAt;

    const playerScores: PlayerMatchScore[] = window.rosterPlayerIds.map((playerId) => {
      const meta = playerMetaById.get(playerId);
      const played = playedPlayerIds.has(playerId);
      const goalPoints = match.goals.filter(
        (g) => !g.isOwnGoal && g.scorerId === playerId
      ).length;
      const bonuses = match.bonuses.filter((bonus) => bonus.playerId === playerId);
      const bonusDetailsByCode = new Map<
        string,
        { code: string; name: string; quantity: number; points: number }
      >();
      for (const bonus of bonuses) {
        const current = bonusDetailsByCode.get(bonus.bonusType.code) ?? {
          code: bonus.bonusType.code,
          name: bonus.bonusType.name,
          quantity: 0,
          points: 0,
        };
        current.quantity += bonus.quantity;
        current.points += Number(bonus.points);
        bonusDetailsByCode.set(current.code, current);
      }
      const bonusDetails = [...bonusDetailsByCode.values()].sort((a, b) =>
        a.code.localeCompare(b.code, "it")
      );
      const bonusPoints = bonusDetails.reduce((sum, bonus) => sum + bonus.points, 0);
      const isMvp = playerId === mvpId;
      const totalPoints = playerPoints.get(playerId) ?? 0;
      const mvpPoints = isMvp ? mvpBonus : 0;
      const isCaptain = window.captainPlayerId === playerId;
      // Se la partita è precedente all'iscrizione, azzera i punti finali
      const finalPoints = beforeRegistration ? 0 : totalPoints * (isCaptain ? 2 : 1);
      return {
        playerId,
        playerName: meta?.name ?? "?",
        footballTeamName: meta?.footballTeam.name ?? "?",
        played,
        goalPoints,
        bonusPoints,
        bonusDetails,
        isMvp,
        mvpPoints,
        basePoints: totalPoints,
        isCaptain,
        finalPoints,
      };
    });

    return {
      matchId: match.id,
      label: `${match.homeTeam?.name ?? match.homeSeed ?? "TBD"} vs ${match.awayTeam?.name ?? match.awaySeed ?? "TBD"}`,
      startsAt: match.startsAt,
      concludedAt: match.concludedAt,
      playerScores,
      total: roundPoints(playerScores.reduce((s, p) => s + p.finalPoints, 0)),
      beforeRegistration,
    };
  });
}

/** Restituisce true se esiste almeno una partita conclusa nel sistema. */
export async function hasConcludedMatches(): Promise<boolean> {
  return (await db.match.count({ where: { status: MatchStatus.CONCLUDED } })) > 0;
}
