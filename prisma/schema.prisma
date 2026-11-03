generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id                Int                @id @default(autoincrement())
  email             String             @unique
  passwordHash      String
  name              String?
  role              UserRole           @default(USER)
  isSuspended       Boolean            @default(false)
  lastLoginAt       DateTime?
  passwordChangedAt DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  fantasyTeam       FantasyTeam?
  votes             Vote[]
  adminAuditLogs    AdminAuditLog[]
  rosterEditWindows RosterEditWindow[]
  scoringPhases     ScoringPhase[]
}

model FantasyTeam {
  id              Int                 @id @default(autoincrement())
  name            String
  userId          Int                 @unique
  captainPlayerId Int
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  captain         Player              @relation("FantasyTeamCaptain", fields: [captainPlayerId], references: [id], onDelete: Restrict)
  players         FantasyTeamPlayer[]
  editUsages      RosterEditUsage[]
  phaseScores     ScoringPhaseScore[]
  rankingSnapshot FantasyRankingSnapshot?

  @@index([captainPlayerId])
}

model FootballTeam {
  id          Int           @id @default(autoincrement())
  name        String        @unique
  shortName   String?
  countryCode String?
  logoUrl     String?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  players     Player[]
  homeMatches Match[]       @relation("HomeTeamMatches")
  awayMatches Match[]       @relation("AwayTeamMatches")
  groupTeams  GroupTeam[]
}

model Player {
  id                      Int                 @id @default(autoincrement())
  name                    String
  role                    PlayerRole
  footballTeamId          Int
  createdAt               DateTime            @default(now())
  updatedAt               DateTime            @updatedAt

  footballTeam            FootballTeam        @relation(fields: [footballTeamId], references: [id], onDelete: Restrict)
  fantasyTeams            FantasyTeamPlayer[]
  captainedByFantasyTeams FantasyTeam[]       @relation("FantasyTeamCaptain")
  votes                   Vote[]
  matchBonuses            PlayerMatchBonus[]
  matchAppearances        MatchPlayer[]
  mvpOverrideMatches       Match[]              @relation("MatchMvpOverride")
  goals                   MatchGoal[]

  @@index([footballTeamId])
  @@index([name])
  @@index([role])
}

model Group {
  id        Int         @id @default(autoincrement())
  name      String      // "Girone A", "Girone B", …
  slug      String      @unique // "A", "B", "C", "D"
  order     Int         @default(0)
  createdAt DateTime    @default(now())

  teams     GroupTeam[]
  matches   Match[]

  @@index([order])
}

model GroupTeam {
  groupId        Int
  footballTeamId Int
  qualified      Boolean      @default(false)

  group          Group        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  footballTeam   FootballTeam @relation(fields: [footballTeamId], references: [id], onDelete: Restrict)

  @@id([groupId, footballTeamId])
  @@index([footballTeamId])
}

model KnockoutRound {
  id        Int      @id @default(autoincrement())
  name      String   // "Quarti di finale", "Semifinale", "Finale 3°/4°", "Finale"
  order     Int      // 1=QF, 2=SF, 3=3°posto, 4=Finale
  createdAt DateTime @default(now())

  matches   Match[]

  @@index([order])
}

model Match {
  id              Int                @id @default(autoincrement())
  homeTeamId      Int?               // null = TBD (solo per slot knockout non ancora assegnati)
  awayTeamId      Int?               // null = TBD
  status          MatchStatus        @default(DRAFT)
  startsAt        DateTime
  homeScore       Int?
  awayScore       Int?
  concludedAt     DateTime?
  mvpOverridePlayerId Int?
  // Fase torneo
  groupId         Int?
  knockoutRoundId Int?
  homeSeed        String?            // es. "1A", "V QF1" — visibile quando squadre TBD
  awaySeed        String?
  bracketPosition Int?               // ordine nel bracket (1,2,3,4 per QF; 1,2 per SF; ecc.)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  homeTeam        FootballTeam?      @relation("HomeTeamMatches", fields: [homeTeamId], references: [id], onDelete: Restrict)
  awayTeam        FootballTeam?      @relation("AwayTeamMatches", fields: [awayTeamId], references: [id], onDelete: Restrict)
  mvpOverridePlayer Player?          @relation("MatchMvpOverride", fields: [mvpOverridePlayerId], references: [id], onDelete: SetNull)
  group           Group?             @relation(fields: [groupId], references: [id], onDelete: SetNull)
  knockoutRound   KnockoutRound?     @relation(fields: [knockoutRoundId], references: [id], onDelete: SetNull)
  players         MatchPlayer[]
  votes           Vote[]
  bonuses         PlayerMatchBonus[]
  goals           MatchGoal[]

  @@index([homeTeamId])
  @@index([awayTeamId])
  @@index([mvpOverridePlayerId])
  @@index([status])
  @@index([startsAt])
  @@index([groupId])
  @@index([knockoutRoundId])
  @@index([status, startsAt])
  @@index([status, concludedAt])
  @@index([groupId, status])
  @@index([knockoutRoundId, status, bracketPosition])
  @@index([homeTeamId, status, startsAt])
  @@index([awayTeamId, status, startsAt])
}

model MatchPlayer {
  matchId   Int
  playerId  Int
  createdAt DateTime @default(now())

  match     Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Restrict)

  @@id([matchId, playerId])
  @@index([playerId])
}

model Vote {
  id        Int      @id @default(autoincrement())
  userId    Int?     // null = voto anonimizzato (utente cancellato): il voto resta valido per l'MVP
  matchId   Int
  playerId  Int
  createdAt DateTime @default(now())

  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  match     Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player    Player   @relation(fields: [playerId], references: [id], onDelete: Restrict)

  @@unique([userId, matchId])
  @@index([matchId])
  @@index([playerId])
  @@index([matchId, playerId])
}

model BonusType {
  id          Int                @id @default(autoincrement())
  code        String             @unique
  name        String             @unique
  points      Decimal            @db.Decimal(5, 2)
  isSecret    Boolean            @default(false)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  assignments PlayerMatchBonus[]

  @@index([isSecret, points, name])
  @@index([isSecret, name])
}

model PlayerMatchBonus {
  id          Int       @id @default(autoincrement())
  playerId    Int
  matchId     Int
  bonusTypeId Int
  points      Decimal   @db.Decimal(5, 2)
  quantity    Int       @default(1)
  createdAt   DateTime  @default(now())

  player      Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  match       Match     @relation(fields: [matchId], references: [id], onDelete: Cascade)
  bonusType   BonusType @relation(fields: [bonusTypeId], references: [id], onDelete: Restrict)

  @@index([playerId])
  @@index([matchId])
  @@index([bonusTypeId])
  @@index([matchId, playerId])
}

model MatchGoal {
  id         Int      @id @default(autoincrement())
  matchId    Int
  scorerId   Int
  isOwnGoal  Boolean  @default(false)
  minute     Int?
  createdAt  DateTime @default(now())

  match      Match    @relation(fields: [matchId], references: [id], onDelete: Cascade)
  scorer     Player   @relation(fields: [scorerId], references: [id], onDelete: Restrict)

  @@index([matchId])
  @@index([scorerId])
  @@index([scorerId, isOwnGoal])
}

model FantasyTeamPlayer {
  fantasyTeamId Int
  playerId      Int
  createdAt     DateTime    @default(now())

  fantasyTeam   FantasyTeam @relation(fields: [fantasyTeamId], references: [id], onDelete: Cascade)
  player        Player      @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([fantasyTeamId, playerId])
  @@index([playerId])
  @@index([playerId, fantasyTeamId])
}

// Finestra di "mercato": periodo in cui gli utenti possono modificare la propria
// rosa, con un numero massimo di sostituzioni giocatore consentite.
model RosterEditWindow {
  id          Int               @id @default(autoincrement())
  opensAt     DateTime
  closesAt    DateTime
  maxChanges  Int               // sostituzioni giocatore consentite per utente
  createdById Int?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  createdBy   User?             @relation(fields: [createdById], references: [id], onDelete: SetNull)
  usages      RosterEditUsage[]

  @@index([opensAt, closesAt])
}

// Conteggio dei cambi usati da una squadra in una specifica finestra.
// baselinePlayerIds = rosa di partenza (al primo salvataggio nella finestra).
model RosterEditUsage {
  windowId          Int
  fantasyTeamId     Int
  baselinePlayerIds Json
  changesUsed       Int      @default(0)
  updatedAt         DateTime @updatedAt

  window      RosterEditWindow @relation(fields: [windowId], references: [id], onDelete: Cascade)
  fantasyTeam FantasyTeam      @relation(fields: [fantasyTeamId], references: [id], onDelete: Cascade)

  @@id([windowId, fantasyTeamId])
  @@index([fantasyTeamId])
}

// Fase di punteggio fanta chiusa (snapshot storico). Alla chiusura i punti di
// ogni squadra in quella fase vengono congelati e non cambiano più.
model ScoringPhase {
  id          Int                 @id @default(autoincrement())
  name        String
  order       Int
  startsAt    DateTime?           // confine inferiore = closedAt della fase precedente (null per la prima)
  closedAt    DateTime            // momento dello snapshot
  createdById Int?
  createdAt   DateTime            @default(now())

  createdBy   User?               @relation(fields: [createdById], references: [id], onDelete: SetNull)
  scores      ScoringPhaseScore[]

  @@unique([order])
}

// Punti congelati di una squadra in una fase (solo i punti di quella fase).
model ScoringPhaseScore {
  phaseId         Int
  fantasyTeamId   Int
  points          Decimal  @db.Decimal(7, 2)
  rosterPlayerIds Json
  captainPlayerId Int

  phase       ScoringPhase @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  fantasyTeam FantasyTeam  @relation(fields: [fantasyTeamId], references: [id], onDelete: Cascade)

  @@id([phaseId, fantasyTeamId])
  @@index([fantasyTeamId])
}

// Snapshot della classifica fantasy cumulativa pubblica.
// Viene invalidato dalle mutazioni che cambiano punti, fasi o rose.
model FantasyRankingSnapshot {
  fantasyTeamId Int      @id
  rank          Int
  totalPoints   Decimal  @db.Decimal(7, 2)
  computedAt    DateTime @default(now())

  fantasyTeam FantasyTeam @relation(fields: [fantasyTeamId], references: [id], onDelete: Cascade)

  @@index([rank])
  @@index([totalPoints])
}

model AdminAuditLog {
  id          Int      @id @default(autoincrement())
  adminUserId Int?
  action      String
  entityType  String
  entityId    String?
  before      Json?
  after       Json?
  createdAt   DateTime @default(now())

  adminUser   User?    @relation(fields: [adminUserId], references: [id], onDelete: SetNull)

  @@index([adminUserId])
  @@index([entityType, entityId])
}

// Aggregated daily page-view counter (one row per calendar day)
model SiteVisit {
  date  String @id // ISO date "YYYY-MM-DD"
  count Int    @default(0)
}

// Impostazioni singleton dell'app (id=1 fisso, upsert).
model AppSetting {
  id                  Int     @id
  registrationOpen    Boolean @default(true)
  tournamentConcluded Boolean @default(false)
}

enum UserRole {
  USER
  ADMIN
}

enum PlayerRole {
  P
  A
}

enum MatchStatus {
  DRAFT
  SCHEDULED
  LIVE
  CONCLUDED
}

// ─── GreenVolley ─────────────────────────────────────────────────────────────

model VolleyTeam {
  id          Int               @id @default(autoincrement())
  name        String
  players     VolleyPlayer[]
  homeMatches VolleyMatch[]     @relation("VolleyHomeTeam")
  awayMatches VolleyMatch[]     @relation("VolleyAwayTeam")
  groups      VolleyGroupTeam[]
  createdAt   DateTime          @default(now())

  @@index([name])
}

model VolleyPlayer {
  id        Int        @id @default(autoincrement())
  name      String
  team      VolleyTeam @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId    Int
  createdAt DateTime   @default(now())

  @@index([teamId])
  @@index([teamId, name])
}

model VolleyMatch {
  id              Int                  @id @default(autoincrement())
  homeTeam        VolleyTeam           @relation("VolleyHomeTeam", fields: [homeTeamId], references: [id])
  homeTeamId      Int
  awayTeam        VolleyTeam           @relation("VolleyAwayTeam", fields: [awayTeamId], references: [id])
  awayTeamId      Int
  status          VolleyMatchStatus    @default(DRAFT)
  date            DateTime?
  homeDisciplinaryPoints Int            @default(0)
  awayDisciplinaryPoints Int            @default(0)
  sets            VolleySet[]
  group           VolleyGroup?         @relation(fields: [groupId], references: [id])
  groupId         Int?
  knockoutRound   VolleyKnockoutRound? @relation(fields: [knockoutRoundId], references: [id])
  knockoutRoundId Int?
  createdAt       DateTime             @default(now())

  @@index([homeTeamId])
  @@index([awayTeamId])
  @@index([groupId])
  @@index([knockoutRoundId])
  @@index([status, date])
  @@index([groupId, status])
  @@index([knockoutRoundId, status, date])
  @@index([homeTeamId, status, date])
  @@index([awayTeamId, status, date])
}

enum VolleyMatchStatus {
  DRAFT
  SCHEDULED
  CONCLUDED
}

model VolleySet {
  id         Int         @id @default(autoincrement())
  match      VolleyMatch @relation(fields: [matchId], references: [id], onDelete: Cascade)
  matchId    Int
  setNumber  Int
  homePoints Int
  awayPoints Int

  @@unique([matchId, setNumber])
  @@index([matchId])
}

model VolleyGroup {
  id      Int               @id @default(autoincrement())
  name    String
  teams   VolleyGroupTeam[]
  matches VolleyMatch[]
}

model VolleyGroupTeam {
  group     VolleyGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  groupId   Int
  team      VolleyTeam  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  teamId    Int
  qualified Boolean     @default(false)

  @@id([groupId, teamId])
  @@index([teamId])
}

model VolleyKnockoutRound {
  id      Int           @id @default(autoincrement())
  name    String
  order   Int
  matches VolleyMatch[]

  @@index([order])
}
