import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const globalDatabase = globalThis as typeof globalThis & { changeFlowDatabase?: Database.Database };

export function databasePath(): string {
  return resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH ?? "./data/changeflow.sqlite");
}

export function getDatabase(): Database.Database {
  if (!globalDatabase.changeFlowDatabase || !globalDatabase.changeFlowDatabase.open) {
    const filePath = databasePath();
    mkdirSync(dirname(filePath), { recursive: true });
    const db = new Database(filePath);
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    globalDatabase.changeFlowDatabase = db;
  }
  return globalDatabase.changeFlowDatabase;
}

export function closeDatabase(): void {
  if (globalDatabase.changeFlowDatabase?.open) globalDatabase.changeFlowDatabase.close();
  delete globalDatabase.changeFlowDatabase;
}
