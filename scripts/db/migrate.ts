import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { getMigrations } from "better-auth/db/migration";

async function migrate() {
  loadEnvConfig(process.cwd());
  const [{ getAuthOptions }, { getDatabase }] = await Promise.all([
    import("@/lib/auth/auth-options"),
    import("@/lib/db/connection"),
  ]);
  const db = getDatabase();
  const authMigrations = await getMigrations(getAuthOptions(db));
  await authMigrations.runMigrations();

  db.exec(`CREATE TABLE IF NOT EXISTS ChangeFlowMigration (
    name TEXT PRIMARY KEY NOT NULL,
    appliedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);

  const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
  const files = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const exists = db.prepare("SELECT 1 FROM ChangeFlowMigration WHERE name = ?").get(name);
    if (exists) continue;
    const sql = readFileSync(join(migrationsDir, name), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO ChangeFlowMigration (name) VALUES (?)").run(name);
    })();
    console.log(`Applied ${name}`);
  }
}

migrate().catch((error: unknown) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});
