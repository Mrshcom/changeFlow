import { betterAuth } from "better-auth";
import type Database from "better-sqlite3";
import { getDatabase } from "@/lib/db/connection";
import { getAuthOptions } from "@/lib/auth/auth-options";

export function createAuth(database: Database.Database = getDatabase()) {
  return betterAuth(getAuthOptions(database));
}

export const auth = createAuth();
