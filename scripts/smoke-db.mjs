import { randomUUID } from "node:crypto";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the database smoke test.");
}

const pool = new Pool({
  connectionString,
  max: 1,
  application_name: "ai-companion-db-smoke",
});

const expectedTables = [
  "account",
  "audit_events",
  "companion_prompt_versions",
  "companions",
  "session",
  "user",
  "verification",
];

try {
  const tables = await pool.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1::text[])`,
    [expectedTables],
  );

  const found = new Set(tables.rows.map((row) => String(row.table_name)));
  const missing = expectedTables.filter((table) => !found.has(table));
  if (missing.length) {
    throw new Error(`Missing migrated tables: ${missing.join(", ")}`);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const ownerId = `smoke-${randomUUID()}`;
    const companionId = randomUUID();
    const promptId = randomUUID();
    const auditId = randomUUID();

    await client.query(
      `insert into companions (
         id, user_id, name, description, model, response_style,
         memory_mode, memory_instructions, active_prompt_version
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
      [
        companionId,
        ownerId,
        "Migration Canary",
        "Transactional database smoke test.",
        "auto",
        "balanced",
        "shared_profile",
        "Remember only that this row must be rolled back.",
      ],
    );

    await client.query(
      `insert into companion_prompt_versions (
         id, companion_id, version, system_prompt, created_by_user_id
       ) values ($1, $2, 1, $3, $4)`,
      [
        promptId,
        companionId,
        "You are a migration canary. Do not survive this transaction.",
        ownerId,
      ],
    );

    await client.query(
      `insert into audit_events (
         id, actor_user_id, action, entity_type, entity_id, metadata
       ) values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        auditId,
        ownerId,
        "smoke.companion.created",
        "companion",
        companionId,
        JSON.stringify({ promptVersion: 1 }),
      ],
    );

    const joined = await client.query(
      `select c.name, p.version, p.system_prompt
         from companions c
         join companion_prompt_versions p
           on p.companion_id = c.id
          and p.version = c.active_prompt_version
        where c.id = $1 and c.user_id = $2`,
      [companionId, ownerId],
    );

    if (
      joined.rowCount !== 1 ||
      joined.rows[0]?.name !== "Migration Canary" ||
      joined.rows[0]?.version !== 1
    ) {
      throw new Error("Companion migration smoke query returned unexpected data.");
    }

    await client.query("rollback");
  } finally {
    client.release();
  }

  console.log("Database migrations and companion transaction smoke test passed.");
} finally {
  await pool.end();
}
