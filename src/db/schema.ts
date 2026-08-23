import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
};

export const companions = pgTable(
  "companions",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    avatarUrl: text("avatar_url"),
    model: varchar("model", { length: 120 }).notNull().default("auto"),
    responseStyle: varchar("response_style", { length: 24 })
      .notNull()
      .default("balanced"),
    memoryMode: varchar("memory_mode", { length: 32 })
      .notNull()
      .default("shared_profile"),
    memoryInstructions: text("memory_instructions").notNull().default(""),
    activePromptVersion: integer("active_prompt_version").notNull().default(1),
    ...timestamps,
    archivedAt: timestamp("archived_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("companions_user_id_idx").on(table.userId),
    index("companions_user_archived_idx").on(table.userId, table.archivedAt),
  ],
);

export const companionPromptVersions = pgTable(
  "companion_prompt_versions",
  {
    id: uuid("id").primaryKey(),
    companionId: uuid("companion_id")
      .notNull()
      .references(() => companions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("companion_prompt_versions_companion_version_uidx").on(
      table.companionId,
      table.version,
    ),
    index("companion_prompt_versions_companion_idx").on(table.companionId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
  ],
);

export type CompanionRecord = typeof companions.$inferSelect;
export type NewCompanionRecord = typeof companions.$inferInsert;
export type CompanionPromptVersionRecord =
  typeof companionPromptVersions.$inferSelect;
