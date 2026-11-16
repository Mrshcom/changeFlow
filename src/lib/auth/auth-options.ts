import type Database from "better-sqlite3";
import { assignRole } from "@/lib/auth/authorization";

export function getAuthOptions(database: Database.Database) {
  return {
    appName: "ChangeFlow",
    database,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
    databaseHooks: {
      user: {
        create: {
          after: async (user: { id: string }) => assignRole(user.id, "Requester", database),
        },
      },
    },
  };
}
