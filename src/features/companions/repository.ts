import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditEvents,
  companionPromptVersions,
  companions,
} from "@/db/schema";
import { HttpError } from "@/lib/http";
import type {
  CompanionDto,
  MemoryMode,
  PromptVersionDto,
  ResponseStyle,
} from "./types";
import type {
  CreateCompanionInput,
  UpdateCompanionInput,
} from "./validation";

const companionSelection = {
  id: companions.id,
  name: companions.name,
  description: companions.description,
  avatarUrl: companions.avatarUrl,
  model: companions.model,
  responseStyle: companions.responseStyle,
  memoryMode: companions.memoryMode,
  memoryInstructions: companions.memoryInstructions,
  promptVersion: companions.activePromptVersion,
  systemPrompt: companionPromptVersions.systemPrompt,
  createdAt: companions.createdAt,
  updatedAt: companions.updatedAt,
  archivedAt: companions.archivedAt,
};

type CompanionRow = {
  id: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  model: string;
  responseStyle: string;
  memoryMode: string;
  memoryInstructions: string;
  promptVersion: number;
  systemPrompt: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

function toDto(row: CompanionRow): CompanionDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatarUrl || "",
    model: row.model,
    responseStyle: row.responseStyle as ResponseStyle,
    memoryMode: row.memoryMode as MemoryMode,
    memoryInstructions: row.memoryInstructions,
    systemPrompt: row.systemPrompt,
    promptVersion: row.promptVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() || null,
  };
}

export async function listCompanions(userId: string): Promise<CompanionDto[]> {
  const rows = await db
    .select(companionSelection)
    .from(companions)
    .innerJoin(
      companionPromptVersions,
      and(
        eq(companionPromptVersions.companionId, companions.id),
        eq(companionPromptVersions.version, companions.activePromptVersion),
      ),
    )
    .where(eq(companions.userId, userId))
    .orderBy(desc(companions.archivedAt), asc(companions.name));

  return (rows as CompanionRow[]).map(toDto);
}

export async function getCompanion(
  userId: string,
  companionId: string,
): Promise<CompanionDto | null> {
  const rows = await db
    .select(companionSelection)
    .from(companions)
    .innerJoin(
      companionPromptVersions,
      and(
        eq(companionPromptVersions.companionId, companions.id),
        eq(companionPromptVersions.version, companions.activePromptVersion),
      ),
    )
    .where(
      and(eq(companions.id, companionId), eq(companions.userId, userId)),
    )
    .limit(1);

  const row = rows[0] as CompanionRow | undefined;
  return row ? toDto(row) : null;
}

export async function createCompanion(
  userId: string,
  input: CreateCompanionInput,
): Promise<CompanionDto> {
  const companionId = randomUUID();
  const promptId = randomUUID();

  await db.transaction(async (transaction) => {
    await transaction.insert(companions).values({
      id: companionId,
      userId,
      name: input.name,
      description: input.description,
      avatarUrl: input.avatarUrl || null,
      model: input.model,
      responseStyle: input.responseStyle,
      memoryMode: input.memoryMode,
      memoryInstructions: input.memoryInstructions,
      activePromptVersion: 1,
    });

    await transaction.insert(companionPromptVersions).values({
      id: promptId,
      companionId,
      version: 1,
      systemPrompt: input.systemPrompt,
      createdByUserId: userId,
    });

    await transaction.insert(auditEvents).values({
      id: randomUUID(),
      actorUserId: userId,
      action: "companion.created",
      entityType: "companion",
      entityId: companionId,
      metadata: {
        promptVersion: 1,
        memoryMode: input.memoryMode,
      },
    });
  });

  const created = await getCompanion(userId, companionId);
  if (!created) throw new Error("Created companion could not be reloaded.");
  return created;
}

export async function updateCompanion(
  userId: string,
  companionId: string,
  input: UpdateCompanionInput,
): Promise<CompanionDto> {
  const existing = await getCompanion(userId, companionId);
  if (!existing) throw new HttpError("Companion not found.", 404);

  if (input.expectedPromptVersion !== existing.promptVersion) {
    throw new HttpError(
      "This companion changed in another session. Reload before editing.",
      409,
    );
  }

  const promptChanged =
    input.systemPrompt !== undefined &&
    input.systemPrompt !== existing.systemPrompt;
  const nextPromptVersion = promptChanged
    ? existing.promptVersion + 1
    : existing.promptVersion;
  const archivedAt =
    input.archived === undefined
      ? existing.archivedAt
        ? new Date(existing.archivedAt)
        : null
      : input.archived
        ? new Date()
        : null;

  await db.transaction(async (transaction) => {
    await transaction
      .update(companions)
      .set({
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        avatarUrl:
          input.avatarUrl === undefined
            ? existing.avatarUrl || null
            : input.avatarUrl || null,
        model: input.model ?? existing.model,
        responseStyle: input.responseStyle ?? existing.responseStyle,
        memoryMode: input.memoryMode ?? existing.memoryMode,
        memoryInstructions:
          input.memoryInstructions ?? existing.memoryInstructions,
        activePromptVersion: nextPromptVersion,
        archivedAt,
        updatedAt: new Date(),
      })
      .where(
        and(eq(companions.id, companionId), eq(companions.userId, userId)),
      );

    if (promptChanged && input.systemPrompt !== undefined) {
      await transaction.insert(companionPromptVersions).values({
        id: randomUUID(),
        companionId,
        version: nextPromptVersion,
        systemPrompt: input.systemPrompt,
        createdByUserId: userId,
      });
    }

    await transaction.insert(auditEvents).values({
      id: randomUUID(),
      actorUserId: userId,
      action: "companion.updated",
      entityType: "companion",
      entityId: companionId,
      metadata: {
        promptChanged,
        promptVersion: nextPromptVersion,
        archived: Boolean(archivedAt),
      },
    });
  });

  const updated = await getCompanion(userId, companionId);
  if (!updated) throw new Error("Updated companion could not be reloaded.");
  return updated;
}

export async function listPromptVersions(
  userId: string,
  companionId: string,
): Promise<PromptVersionDto[]> {
  const owned = await db
    .select({ id: companions.id })
    .from(companions)
    .where(
      and(eq(companions.id, companionId), eq(companions.userId, userId)),
    )
    .limit(1);

  if (!owned[0]) throw new HttpError("Companion not found.", 404);

  const rows = await db
    .select({
      id: companionPromptVersions.id,
      version: companionPromptVersions.version,
      systemPrompt: companionPromptVersions.systemPrompt,
      createdAt: companionPromptVersions.createdAt,
    })
    .from(companionPromptVersions)
    .where(eq(companionPromptVersions.companionId, companionId))
    .orderBy(desc(companionPromptVersions.version));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}
