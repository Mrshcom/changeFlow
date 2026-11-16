import { loadEnvConfig } from "@next/env";

type SeedAccount = { name: string; email: string | undefined; password: string | undefined; roles: ("Requester" | "Reviewer")[] };

async function ensureAccount(account: SeedAccount) {
  if (!account.email || !account.password) {
    throw new Error(`Missing seed credentials for ${account.name}; set all SEED_* variables in .env.local.`);
  }
  const [{ createAuth }, { assignRole }, { getDatabase }] = await Promise.all([
    import("@/lib/auth/auth"),
    import("@/lib/auth/authorization"),
    import("@/lib/db/connection"),
  ]);
  const db = getDatabase();
  const existing = db.prepare("SELECT id FROM user WHERE email = ?").get(account.email) as { id: string } | undefined;
  let userId = existing?.id;
  if (!userId) {
    const result = await createAuth(db).api.signUpEmail({
      body: { name: account.name, email: account.email, password: account.password },
    });
    userId = result.user.id;
  }
  for (const role of account.roles) assignRole(userId, role, db);
  console.log(`Ensured ${account.name} account and requested role memberships.`);
}

async function seed() {
  loadEnvConfig(process.cwd());
  const common = { name: "Demo", password: process.env.SEED_REQUESTER_PASSWORD };
  await ensureAccount({
    name: "Requester",
    email: process.env.SEED_REQUESTER_EMAIL,
    password: common.password,
    roles: ["Requester"],
  });
  await ensureAccount({
    name: "Reviewer",
    email: process.env.SEED_REVIEWER_EMAIL,
    password: process.env.SEED_REVIEWER_PASSWORD,
    roles: ["Reviewer"],
  });
  await ensureAccount({
    name: "Dual role user",
    email: process.env.SEED_DUAL_EMAIL,
    password: process.env.SEED_DUAL_PASSWORD,
    roles: ["Requester", "Reviewer"],
  });
}

seed().catch((error: unknown) => {
  console.error("Database seed failed", error);
  process.exitCode = 1;
});
