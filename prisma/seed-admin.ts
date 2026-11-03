import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { decideAdminSync } from "../lib/admin-sync";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL e ADMIN_PASSWORD sono obbligatorie: seed admin interrotto."
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD troppo corta: minimo ${MIN_PASSWORD_LENGTH} caratteri.`
    );
  }

  const existing = await db.user.findUnique({
    where: { email },
    select: { role: true, passwordHash: true },
  });

  const passwordMatches = existing
    ? await bcrypt.compare(password, existing.passwordHash)
    : false;

  const actions = decideAdminSync({
    exists: !!existing,
    role: existing?.role ?? "",
    passwordMatches,
  });

  if (actions.includes("create")) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await db.user.create({
      data: { email, passwordHash, name: "Admin", role: UserRole.ADMIN },
    });
    console.log(`✓ Admin creato: ${email}`);
    return;
  }

  if (actions.length === 0) {
    console.log(`· Admin invariato: ${email}`);
    return;
  }

  const data: {
    role?: UserRole;
    passwordHash?: string;
    passwordChangedAt?: Date;
  } = {};

  if (actions.includes("promote")) data.role = UserRole.ADMIN;
  if (actions.includes("update-password")) {
    data.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    data.passwordChangedAt = new Date();
  }

  await db.user.update({ where: { email }, data });

  if (actions.includes("promote")) console.log(`✓ Admin promosso: ${email}`);
  if (actions.includes("update-password")) {
    console.log(`✓ Password admin aggiornata: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
