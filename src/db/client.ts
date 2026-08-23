import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function databaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    return "postgresql://ai_companion:ai_companion@127.0.0.1:5432/ai_companion";
  }

  throw new Error("DATABASE_URL is required in production.");
}

const globalForDatabase = globalThis as unknown as {
  aiCompanionPool?: Pool;
};

export const pool =
  globalForDatabase.aiCompanionPool ??
  new Pool({
    connectionString: databaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "ai-companion",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.aiCompanionPool = pool;
}

export const db = drizzle(pool, { schema });
