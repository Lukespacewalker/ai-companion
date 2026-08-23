import path from "node:path";
import process from "node:process";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run application migrations.");
}

const pool = new Pool({
  connectionString,
  max: 1,
  application_name: "ai-companion-migrator",
});

try {
  const database = drizzle(pool);
  await migrate(database, {
    migrationsFolder: path.resolve(process.cwd(), "drizzle"),
  });
  console.log("Application migrations are up to date.");
} finally {
  await pool.end();
}
