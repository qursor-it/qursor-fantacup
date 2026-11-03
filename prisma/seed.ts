import { MatchStatus, PlayerRole, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

// ─── Squadre e giocatori ───────────────────────────────────────────────────
const DEV_TEAMS: {
  name: string;
  shortName: string;
  players: { name: string; role: PlayerRole }[];
}[] = [
  {
    name: "Atletico San Marco",
    shortName: "ASM",
    players: [
      { name: "Luca Ferri",     role: PlayerRole.P },
      { name: "Davide Riva",    role: PlayerRole.A },
      { name: "Nicolò Serra",   role: PlayerRole.A },
      { name: "Matteo Guidi",   role: PlayerRole.A },
      { name: "Samuele Costa",  role: PlayerRole.A },
    ],
  },
  {
    name: "Borgo United",
    shortName: "BOR",
    players: [
      { name: "Marco Neri",      role: PlayerRole.P },
      { name: "Andrea Testa",    role: PlayerRole.A },
      { name: "Gabriele Vanni",  role: PlayerRole.A },
      { name: "Tommaso Fabbri",  role: PlayerRole.A },
      { name: "Edoardo Sala",    role: PlayerRole.A },
    ],
  },
  {
    name: "FC Aurora",
    shortName: "AUR",
    players: [
      { name: "Pietro Villa",   role: PlayerRole.P },
      { name: "Riccardo Leoni", role: PlayerRole.A },
      { name: "Francesco Pini", role: PlayerRole.A },
      { name: "Mattia Orsi",    role: PlayerRole.A },
      { name: "Alessio Bassi",  role: PlayerRole.A },
    ],
  },
  {
    name: "Real Montello",
    shortName: "RMO",
    players: [
      { name: "Simone Gallo",     role: PlayerRole.P },
      { name: "Lorenzo Greco",    role: PlayerRole.A },
      { name: "Filippo Conte",    role: PlayerRole.A },
      { name: "Leonardo Parisi",  role: PlayerRole.A },
      { name: "Christian Berni",  role: PlayerRole.A },
    ],
  },
  {
    name: "Stella Rossa 1987",
    shortName: "SR8",
    players: [
      { name: "Michele Bruni",  role: PlayerRole.P },
      { name: "Daniele Sarti",  role: PlayerRole.A },
      { name: "Jacopo Romani",  role: PlayerRole.A },
      { name: "Elia Marini",    role: PlayerRole.A },
      { name: "Diego Bellini",  role: PlayerRole.A },
    ],
  },
  {
    name: "Virtus Porto",
    shortName: "VPO",
    players: [
      { name: "Federico Rossi",    role: PlayerRole.P },
      { name: "Giulio Donati",     role: PlayerRole.A },
      { name: "Kevin Napoletano",  role: PlayerRole.A },
      { name: "Yuri Magnani",      role: PlayerRole.A },
      { name: "Natan De Luca",     role: PlayerRole.A },
    ],
  },
  {
    name: "Polisportiva Ovest",
    shortName: "POV",
    players: [
      { name: "Stefano Manca",   role: PlayerRole.P },
      { name: "Luca Battaglia",  role: PlayerRole.A },
      { name: "Emilio Ferretti", role: PlayerRole.A },
      { name: "Giorgio Lanza",   role: PlayerRole.A },
      { name: "Roberto Amato",   role: PlayerRole.A },
    ],
  },
  {
    name: "Racing Club Torre",
    shortName: "RCT",
    players: [
      { name: "Claudio Esposito", role: PlayerRole.P },
      { name: "Mirko Palumbo",    role: PlayerRole.A },
      { name: "Sergio Vitale",    role: PlayerRole.A },
      { name: "Antonio Ferraro",  role: PlayerRole.A },
      { name: "Pasquale Leone",   role: PlayerRole.A },
    ],
  },
];

// ─── Gironi con partite e qualificati ─────────────────────────────────────
// Girone A: COMPLETO — tutte le partite concluse, 2 qualificati marcati
//   Classifica finale: ASM 9pt ✓ | RMO 6pt ✓ | BOR 3pt | AUR 0pt
//
// Girone B: IN CORSO — 3 partite concluse su 6, nessun qualificato ancora
//   Classifica parziale: POV 6pt | SR8 1pt | VPO 1pt | RCT 0pt
const DEV_GROUPS: {
  name: string;
  slug: string;
  order: number;
  teams: string[];
  qualified: string[];
  matches: {
    home: string;
    away: string;
    date: string;
    status: MatchStatus;
    homeScore: number | null;
    awayScore: number | null;
    concludedAt: string | null;
  }[];
}[] = [
  {
    name: "Girone A",
    slug: "A",
    order: 1,
    teams: ["Atletico San Marco", "Borgo United", "FC Aurora", "Real Montello"],
    qualified: ["Atletico San Marco", "Real Montello"],
    matches: [
      // Giornata 1
      { home: "Atletico San Marco", away: "Borgo United",    date: "2026-06-07T16:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 2, awayScore: 1, concludedAt: "2026-06-07T17:45:00.000Z" },
      { home: "FC Aurora",          away: "Real Montello",   date: "2026-06-07T18:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 0, awayScore: 2, concludedAt: "2026-06-07T19:45:00.000Z" },
      // Giornata 2
      { home: "Atletico San Marco", away: "FC Aurora",       date: "2026-06-14T16:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 3, awayScore: 0, concludedAt: "2026-06-14T17:45:00.000Z" },
      { home: "Borgo United",       away: "Real Montello",   date: "2026-06-14T18:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 0, awayScore: 2, concludedAt: "2026-06-14T19:45:00.000Z" },
      // Giornata 3
      { home: "Real Montello",      away: "Atletico San Marco", date: "2026-06-21T16:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 0, awayScore: 1, concludedAt: "2026-06-21T17:45:00.000Z" },
      { home: "FC Aurora",          away: "Borgo United",    date: "2026-06-21T18:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 0, awayScore: 2, concludedAt: "2026-06-21T19:45:00.000Z" },
    ],
  },
  {
    name: "Girone B",
    slug: "B",
    order: 2,
    teams: ["Stella Rossa 1987", "Virtus Porto", "Polisportiva Ovest", "Racing Club Torre"],
    qualified: [],
    matches: [
      // Giornata 1
      { home: "Stella Rossa 1987",   away: "Virtus Porto",        date: "2026-06-07T16:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 1, awayScore: 1, concludedAt: "2026-06-07T17:45:00.000Z" },
      { home: "Polisportiva Ovest",  away: "Racing Club Torre",   date: "2026-06-07T18:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 3, awayScore: 0, concludedAt: "2026-06-07T19:45:00.000Z" },
      // Giornata 2
      { home: "Stella Rossa 1987",   away: "Polisportiva Ovest",  date: "2026-06-14T16:00:00.000Z", status: MatchStatus.CONCLUDED, homeScore: 0, awayScore: 1, concludedAt: "2026-06-14T17:45:00.000Z" },
      { home: "Virtus Porto",        away: "Racing Club Torre",   date: "2026-06-07T14:00:00.000Z", status: MatchStatus.SCHEDULED, homeScore: null, awayScore: null, concludedAt: null },
      // Giornata 3
      { home: "Racing Club Torre",   away: "Stella Rossa 1987",   date: "2026-06-08T16:00:00.000Z", status: MatchStatus.SCHEDULED, homeScore: null, awayScore: null, concludedAt: null },
      { home: "Virtus Porto",        away: "Polisportiva Ovest",  date: "2026-06-08T18:00:00.000Z", status: MatchStatus.SCHEDULED, homeScore: null, awayScore: null, concludedAt: null },
    ],
  },
];

// ─── Bonus types ──────────────────────────────────────────────────────────
async function seedBonusTypes() {
  const bonusTypes = [
    // Positivi
    { code: "ACCESSORY_MATCH",       name: "Accessorio in comune (squadra)",  points:  1.0, isSecret: false },
    { code: "GOAL_1_3",              name: "Giocatore segna 1-3 gol",         points:  3.0, isSecret: false },
    { code: "GOAL_4_PLUS",           name: "Giocatore segna 4+ gol",          points:  2.0, isSecret: false },
    { code: "GOALKEEPER_GOAL",       name: "Gol del portiere",                points:  3.0, isSecret: false },
    { code: "SEXY_CELEBRATION",      name: "Esultanza sexy (con impegno)",    points:  1.0, isSecret: false },
    { code: "INTERVIEWED",           name: "Intervistato",                    points:  3.0, isSecret: false },
    { code: "INTERVIEWER",           name: "Chi intervista",                  points:  1.0, isSecret: false },
    { code: "MOTM",                  name: "MOTM",                            points:  3.0, isSecret: false },
    { code: "FAN_FAVORITE",          name: "Fan Favorite (voto su app)",      points:  3.0, isSecret: false },
    { code: "GOALKEEPER_CONCEDED",    name: "Portiere prende 1-5 gol",        points:  2.0, isSecret: false },
    { code: "GOALKEEPER_CONCEDED_6P", name: "Portiere prende 6+ gol",         points:  3.0, isSecret: false },
    { code: "OWN_GOAL",              name: "Autogol",                         points:  1.0, isSecret: false },
    { code: "FIRST_GOAL",            name: "Primo gol della partita",         points:  1.0, isSecret: false },
    // Negativi
    { code: "YELLOW_CARD",           name: "Ammonizione",                     points: -1.0, isSecret: false },
    { code: "RED_CARD",              name: "Rosso",                           points: -2.0, isSecret: false },
    { code: "LEAST_FAN_FAVORITE",    name: "Least Fan Favorite (meno votato)", points:  3.0, isSecret: false },
    { code: "BALL_TO_BAR",           name: "Pallone al bar",                  points: -3.0, isSecret: false },
    { code: "BALL_IN_GREVE",         name: "Pallone in Greve",                points: -5.0, isSecret: false },
    { code: "CLEAN_SHEET",           name: "Clean Sheet",                     points: -1.0, isSecret: false },
    { code: "PENALTY_MISSED",        name: "Rigore sbagliato",                points: -2.0, isSecret: false },
    // Segreti
    { code: "SECRET_TEST",            name: "Bonus segreto di prova",          points:  5.0, isSecret: true  },
    { code: "SECRET_TEST_2",          name: "Bonus segreto di prova 2",        points:  2.0, isSecret: true  },
  ];

  for (const bt of bonusTypes) {
    await db.bonusType.upsert({
      where: { code: bt.code },
      update: { name: bt.name, points: bt.points, isSecret: bt.isSecret },
      create: bt,
    });
  }

  console.log(`✓ Bonus type verificati: ${bonusTypes.length} tipi`);
}

// ─── Torneo ───────────────────────────────────────────────────────────────
async function seedDevTournamentData() {
  if (process.env.NODE_ENV === "production") {
    console.log("· Seed dev torneo saltato in produzione");
    return;
  }

  // 1. Squadre e giocatori
  const teamIds = new Map<string, number>();
  const playerIdsByTeam = new Map<string, number[]>();

  for (const team of DEV_TEAMS) {
    const ft = await db.footballTeam.upsert({
      where: { name: team.name },
      update: { shortName: team.shortName },
      create: { name: team.name, shortName: team.shortName },
    });
    teamIds.set(team.name, ft.id);
    playerIdsByTeam.set(team.name, []);

    for (const player of team.players) {
      const existing = await db.player.findFirst({
        where: { name: player.name, footballTeamId: ft.id },
      });
      const saved = existing ?? await db.player.create({
        data: { name: player.name, role: player.role, footballTeamId: ft.id },
      });
      playerIdsByTeam.get(team.name)!.push(saved.id);
    }
  }

  // 2. Gironi, partite e qualificati
  let totalMatches = 0;

  for (const group of DEV_GROUPS) {
    // Crea o aggiorna il girone
    const savedGroup = await db.group.upsert({
      where: { slug: group.slug },
      update: { name: group.name, order: group.order },
      create: { name: group.name, slug: group.slug, order: group.order },
    });

    // Assegna le squadre al girone
    for (const teamName of group.teams) {
      const footballTeamId = teamIds.get(teamName);
      if (!footballTeamId) throw new Error(`Squadra non trovata: ${teamName}`);

      await db.groupTeam.upsert({
        where: { groupId_footballTeamId: { groupId: savedGroup.id, footballTeamId } },
        update: {},
        create: {
          groupId: savedGroup.id,
          footballTeamId,
          qualified: group.qualified.includes(teamName),
        },
      });

      // Aggiorna il flag qualified se il record esiste già
      if (group.qualified.includes(teamName)) {
        await db.groupTeam.update({
          where: { groupId_footballTeamId: { groupId: savedGroup.id, footballTeamId } },
          data: { qualified: true },
        });
      }
    }

    // Crea le partite del girone
    for (const match of group.matches) {
      const homeTeamId = teamIds.get(match.home);
      const awayTeamId = teamIds.get(match.away);
      if (!homeTeamId || !awayTeamId) {
        throw new Error(`Squadre mancanti per ${match.home} vs ${match.away}`);
      }

      const startsAt = new Date(match.date);
      const concludedAt = match.concludedAt ? new Date(match.concludedAt) : null;

      const existing = await db.match.findFirst({
        where: { homeTeamId, awayTeamId, startsAt },
        select: { id: true },
      });

      const saved = existing
        ? await db.match.update({
            where: { id: existing.id },
            data: {
              groupId: savedGroup.id,
              status: match.status,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              concludedAt,
            },
          })
        : await db.match.create({
            data: {
              groupId: savedGroup.id,
              homeTeamId,
              awayTeamId,
              startsAt,
              status: match.status,
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              concludedAt,
            },
          });

      // Assegna i giocatori alla partita
      const players = [
        ...(playerIdsByTeam.get(match.home) ?? []),
        ...(playerIdsByTeam.get(match.away) ?? []),
      ];
      for (const playerId of players) {
        await db.matchPlayer.upsert({
          where: { matchId_playerId: { matchId: saved.id, playerId } },
          update: {},
          create: { matchId: saved.id, playerId },
        });
      }

      totalMatches++;
    }

    const qualifiedCount = group.qualified.length;
    console.log(
      `✓ ${group.name}: ${group.teams.length} squadre, ${group.matches.length} partite` +
      (qualifiedCount > 0 ? `, ${qualifiedCount} qualificati (${group.qualified.join(", ")})` : " (girone in corso)")
    );
  }

  console.log(
    `✓ Seed dev: ${DEV_TEAMS.length} squadre, ` +
    `${DEV_TEAMS.flatMap((t) => t.players).length} giocatori, ` +
    `${DEV_GROUPS.length} gironi, ` +
    `${totalMatches} partite`
  );
}

// ─── Fase a eliminazione ──────────────────────────────────────────────────
async function seedKnockoutRounds() {
  if (process.env.NODE_ENV === "production") return;

  const rounds = [
    { name: "Semifinali",     order: 1 },
    { name: "Finale 3°/4°",  order: 2 },
    { name: "Finale",         order: 3 },
  ];

  const savedRounds = new Map<string, number>();
  for (const r of rounds) {
    const existing = await db.knockoutRound.findFirst({ where: { order: r.order } });
    const saved = existing ?? await db.knockoutRound.create({ data: r });
    savedRounds.set(r.name, saved.id);
  }

  // Semifinali: 1°A vs 2°B, 1°B vs 2°A (squadre Girone B ancora TBD)
  const sfId = savedRounds.get("Semifinali")!;
  const sf1Exists = await db.match.findFirst({ where: { knockoutRoundId: sfId, bracketPosition: 1 } });
  if (!sf1Exists) {
    await db.match.create({ data: { knockoutRoundId: sfId, status: MatchStatus.SCHEDULED, startsAt: new Date("2026-06-13T16:00:00.000Z"), homeSeed: "1A", awaySeed: "2B", bracketPosition: 1 } });
    await db.match.create({ data: { knockoutRoundId: sfId, status: MatchStatus.SCHEDULED, startsAt: new Date("2026-06-13T18:00:00.000Z"), homeSeed: "1B", awaySeed: "2A", bracketPosition: 2 } });
  }

  // Finale 3°/4°
  const f3Id = savedRounds.get("Finale 3°/4°")!;
  const f3Exists = await db.match.findFirst({ where: { knockoutRoundId: f3Id } });
  if (!f3Exists) {
    await db.match.create({ data: { knockoutRoundId: f3Id, status: MatchStatus.SCHEDULED, startsAt: new Date("2026-06-20T15:00:00.000Z"), homeSeed: "Perd. SF1", awaySeed: "Perd. SF2", bracketPosition: 1 } });
  }

  // Finale
  const finId = savedRounds.get("Finale")!;
  const finExists = await db.match.findFirst({ where: { knockoutRoundId: finId } });
  if (!finExists) {
    await db.match.create({ data: { knockoutRoundId: finId, status: MatchStatus.SCHEDULED, startsAt: new Date("2026-06-20T17:00:00.000Z"), homeSeed: "Vince SF1", awaySeed: "Vince SF2", bracketPosition: 1 } });
  }

  console.log("✓ Turni eliminazione: Semifinali (13/06), Finale 3°/4° + Finale (20/06)");
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  await seedBonusTypes();
  await seedDevTournamentData();
  await seedKnockoutRounds();
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => db.$disconnect());
