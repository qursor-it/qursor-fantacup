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

  const [managedUsers, existing] = await Promise.all([
    db.user.findMany({
      where: { provisionedPasswordHash: { not: null } },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        provisionedPasswordHash: true,
      },
    }),
    db.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, passwordHash: true },
    }),
  ]);

  const managed = managedUsers[0] ?? null;

  const credentialMatchesProvisioned = managed?.provisionedPasswordHash
    ? await bcrypt.compare(password, managed.provisionedPasswordHash)
    : false;
  const passwordMatches = existing
    ? await bcrypt.compare(password, existing.passwordHash)
    : false;

  const decision = decideAdminSync({
    managedCount: managedUsers.length,
    managed: managed
      ? {
          emailMatches: managed.email === email,
          roleIsAdmin: managed.role === UserRole.ADMIN,
          credentialMatchesProvisioned,
        }
      : null,
    existingWithEnvEmail: {
      exists: !!existing,
      isManaged: !!existing && managed?.id === existing.id,
      passwordMatches,
    },
  });

  if (!decision.ok) {
    if (decision.error === "multiple-managed") {
      throw new Error(
        `Trovati più account gestiti dal deploy (provisionedPasswordHash non null): ${managedUsers
          .map((u) => u.id)
          .join(", ")}. Sistemare manualmente prima di riprovare.`
      );
    }
    throw new Error(
      `ADMIN_EMAIL ${email} è già usato da un altro account: nessun merge automatico, intervento manuale richiesto.`
    );
  }

  const actions = decision.actions;

  if (actions.includes("create")) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await db.user.create({
      data: {
        email,
        passwordHash,
        provisionedPasswordHash: passwordHash,
        name: "Admin",
        role: UserRole.ADMIN,
      },
    });
    console.log(`✓ Admin creato: ${email}`);
    return;
  }

  if (actions.length === 0) {
    console.log(`· Admin invariato: ${email}`);
    return;
  }

  if (actions.includes("adopt")) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing!.id },
        data: {
          role: UserRole.ADMIN,
          passwordHash,
          provisionedPasswordHash: passwordHash,
          ...(actions.includes("adopt-set-password-changed-at")
            ? { passwordChangedAt: new Date() }
            : {}),
        },
      });
    });
    console.log(`✓ Admin adottato: ${email}`);
    if (actions.includes("adopt-set-password-changed-at")) {
      console.log(`✓ Sessione admin invalidata (password cambiata): ${email}`);
    }
    return;
  }

  const data: {
    email?: string;
    role?: UserRole;
    passwordHash?: string;
    provisionedPasswordHash?: string;
    passwordChangedAt?: Date;
  } = {};

  if (actions.includes("rename-email")) data.email = email;
  if (actions.includes("promote")) data.role = UserRole.ADMIN;
  if (actions.includes("rotate-password")) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    data.passwordHash = passwordHash;
    data.provisionedPasswordHash = passwordHash;
    data.passwordChangedAt = new Date();
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: managed!.id }, data });
  });

  if (actions.includes("rename-email")) {
    console.log(`✓ Email admin aggiornata: ${managed!.email} -> ${email}`);
  }
  if (actions.includes("promote")) {
    console.log(`✓ Ruolo ADMIN garantito: ${email}`);
  }
  if (actions.includes("rotate-password")) {
    console.log(`✓ Password admin ruotata: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
