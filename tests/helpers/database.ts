import Database from "better-sqlite3";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getMigrations } from "better-auth/db/migration";
import { getAuthOptions } from "@/lib/auth/auth-options";
import { assignRole, type Role } from "@/lib/auth/authorization";
import { closeDatabase } from "@/lib/db/connection";

export type TestDatabase = {
  db: Database.Database;
  directory: string;
  path: string;
  dispose: () => void;
};

export async function createTestDatabase(): Promise<TestDatabase> {
  const directory = mkdtempSync(join(tmpdir(), "changeflow-test-"));
  const path = join(directory, "test.sqlite");
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  const authMigrations = await getMigrations(getAuthOptions(db));
  await authMigrations.runMigrations();
  const migrationsDir = join(process.cwd(), "src", "lib", "db", "migrations");
  for (const filename of readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(migrationsDir, filename), "utf8"));
  }
  return {
    db,
    directory,
    path,
    dispose: () => {
      closeDatabase();
      if (db.open) db.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export async function provisionTestUser(
  db: Database.Database,
  name: string,
  email: string,
  password = "Test-password-123!",
  roles: Role[] = ["Requester"],
) {
  const { createAuth } = await import("@/lib/auth/auth");
  const result = await createAuth(db).api.signUpEmail({ body: { name, email, password } });
  for (const role of roles) assignRole(result.user.id, role, db);
  return { user: result.user, password };
}

export function sessionCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("Better Auth did not issue a session cookie.");
  return setCookie.split(";")[0];
}
