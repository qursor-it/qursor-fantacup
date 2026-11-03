/**
 * Go-live checklist per Fantadc.
 * Verifica i prerequisiti necessari prima di aprire l'app agli utenti.
 *
 * Esegui con: npx tsx scripts/go-live-check.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

type CheckResult = { label: string; ok: boolean; detail?: string };

async function run() {
  const results: CheckResult[] = [];

  // 1. Database raggiungibile
  try {
    await db.$queryRaw`SELECT 1`;
    results.push({ label: "Database raggiungibile", ok: true });
  } catch (e) {
    results.push({ label: "Database raggiungibile", ok: false, detail: String(e) });
    // Se non c'è DB, gli altri check non hanno senso
    printResults(results);
    process.exit(1);
  }

  // 2. Admin presente
  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  results.push({
    label: "Admin presente",
    ok: adminCount > 0,
    detail: adminCount > 0 ? `${adminCount} admin` : "Eseguire: npm run db:seed-admin",
  });

  // 3. Bonus type caricati
  const bonusTypeCount = await db.bonusType.count();
  const hasMvp = await db.bonusType.findFirst({ where: { code: "MVP" } });
  results.push({
    label: "Bonus type caricati",
    ok: bonusTypeCount > 0 && !!hasMvp,
    detail:
      bonusTypeCount > 0
        ? `${bonusTypeCount} tipi${hasMvp ? ", MVP presente" : " — bonus MVP mancante"}`
        : "Eseguire: npm run db:seed",
  });

  // 4. Squadre reali presenti
  const teamCount = await db.footballTeam.count();
  results.push({
    label: "Squadre reali caricate",
    ok: teamCount > 0,
    detail:
      teamCount > 0
        ? `${teamCount} squadre`
        : "Aggiungere squadre via admin o: npx tsx prisma/seed-tournament.ts",
  });

  // 5. Giocatori presenti
  const playerCount = await db.player.count();
  results.push({
    label: "Giocatori caricati",
    ok: playerCount > 0,
    detail:
      playerCount > 0
        ? `${playerCount} giocatori`
        : "Aggiungere giocatori via admin o: npx tsx prisma/seed-tournament.ts",
  });

  // 6. AUTH_SECRET configurato
  const hasAuthSecret = !!process.env.AUTH_SECRET;
  results.push({
    label: "AUTH_SECRET configurato",
    ok: hasAuthSecret,
    detail: hasAuthSecret ? "ok" : "Impostare AUTH_SECRET nel file .env",
  });

  // 7. Credenziali admin configurate per il seed
  const hasAdminCredentials = !!process.env.ADMIN_EMAIL && !!process.env.ADMIN_PASSWORD;
  results.push({
    label: "Credenziali admin configurate",
    ok: hasAdminCredentials,
    detail: hasAdminCredentials
      ? "ok"
      : "Impostare ADMIN_EMAIL e ADMIN_PASSWORD (o la credential Jenkins)",
  });

  // ─── Report ─────────────────────────────────────────────────────────────────
  printResults(results);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\n❌ ${failed.length} check non superati. Risolvere prima del go-live.\n`);
    process.exit(1);
  } else {
    console.log("\n✅ Tutti i check superati — l'app è pronta per il go-live!\n");
  }
}

function printResults(results: CheckResult[]) {
  console.log("\n═══════════════════════════════════════");
  console.log("  Fantadc — Go-live checklist");
  console.log("═══════════════════════════════════════");
  for (const r of results) {
    const icon = r.ok ? "✓" : "✗";
    const line = `${icon} ${r.label}`;
    console.log(r.detail ? `${line} (${r.detail})` : line);
  }
  console.log("═══════════════════════════════════════");
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
