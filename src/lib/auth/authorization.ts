import type Database from "better-sqlite3";
import { getDatabase } from "@/lib/db/connection";

export type Role = "Requester" | "Reviewer";

export function getUserRoles(userId: string, db: Database.Database = getDatabase()): Role[] {
  return (db.prepare("SELECT role FROM UserRole WHERE userId = ? ORDER BY role").all(userId) as { role: Role }[])
    .map(({ role }) => role);
}

export function hasRole(userId: string, role: Role, db: Database.Database = getDatabase()): boolean {
  return db.prepare("SELECT 1 FROM UserRole WHERE userId = ? AND role = ?").get(userId, role) !== undefined;
}

export function assignRole(userId: string, role: Role, db: Database.Database = getDatabase()): void {
  db.prepare("INSERT OR IGNORE INTO UserRole (userId, role) VALUES (?, ?)").run(userId, role);
}

export function revokeRole(userId: string, role: Role, db: Database.Database = getDatabase()): void {
  db.prepare("DELETE FROM UserRole WHERE userId = ? AND role = ?").run(userId, role);
}
