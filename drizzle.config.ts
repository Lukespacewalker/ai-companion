import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  "postgresql://ai_companion:ai_companion@127.0.0.1:5432/ai_companion";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
