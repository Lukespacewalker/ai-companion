import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "@/db/client";
import { HttpError } from "@/lib/http";
import type { GrokChatMessage } from "@/lib/grok/types";
import {
  boundConversationContext,
  buildRollingChatDigest,
  deriveChatTitle,
  type CompanionGenerationContext,
} from "./context";
import type {
  ChatDetailDto,
  ChatMessageDto,
  ChatSummaryDto,
} from "./types";
import type {
  CreateChatInput,
  SendChatMessageInput,
  UpdateChatInput,
} from "./validation";

interface ChatSummaryRow {
  id: string;
  companion_id: string;
  companion_name: string;
  companion_avatar_url: string | null;
  title: string;
  summary: string;
  summary_revision: number;
  message_count: number | string;
  last_message_preview: string | null;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  archived_at: Date | null;
}

interface MessageRow {
  id: string;
  parent_message_id: string | null;
  sequence: number;
  role: string;
  content: string;
  status: string;
  provider: string | null;
  provider_model: string | null;
  provider_session_id: string | null;
  prompt_version: number | null;
  error: string | null;
  created_at: Date;
  completed_at: Date | null;
}

interface LockedChatRow extends ChatSummaryRow {
  companion_model: string;
  response_style: string;
  memory_mode: string;
  memory_instructions: string;
  prompt_version: number;
  system_prompt: string;
  companion_archived_at: Date | null;
}

export interface PreparedGenerationTurn {
  kind: "generate";
  chat: ChatSummaryDto;
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
  conversation: GrokChatMessage[];
  companion: CompanionGenerationContext;
  model?: string;
  promptVersion: number;
  previousSummary: string;
  userText: string;
}

export interface ReplayedGenerationTurn {
  kind: "replay";
  chat: ChatSummaryDto;
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}

export type PreparedTurn = PreparedGenerationTurn | ReplayedGenerationTurn;

function toChatSummaryDto(row: ChatSummaryRow): ChatSummaryDto {
  return {
    id: row.id,
    companionId: row.companion_id,
    companionName: row.companion_name,
    companionAvatarUrl: row.companion_avatar_url || "",
    title: row.title,
    summary: row.summary,
    summaryRevision: Number(row.summary_revision),
    messageCount: Number(row.message_count || 0),
    lastMessagePreview: row.last_message_preview || "",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    lastMessageAt: row.last_message_at.toISOString(),
    archivedAt: row.archived_at?.toISOString() || null,
  };
}

function toMessageDto(row: MessageRow): ChatMessageDto {
  const role = row.role === "assistant" ? "assistant" : "user";
  const allowedStatuses = new Set(["pending", "completed", "failed", "cancelled"]);
  const status = allowedStatuses.has(row.status) ? row.status : "failed";

  return {
    id: row.id,
    parentMessageId: row.parent_message_id,
    sequence: Number(row.sequence),
    role,
    content: row.content,
    status: status as ChatMessageDto["status"],
    provider: row.provider,
    providerModel: row.provider_model,
    providerSessionId: row.provider_session_id,
    promptVersion:
      row.prompt_version === null ? null : Number(row.prompt_version),
    error: row.error,
    createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() || null,
  };
}

const chatSummarySelect = `
  select
    ch.id,
    ch.companion_id,
    c.name as companion_name,
    c.avatar_url as companion_avatar_url,
    ch.title,
    ch.summary,
    ch.summary_revision,
    (
      select count(*)::integer
      from messages message_count
      where message_count.chat_id = ch.id
    ) as message_count,
    coalesce((
      select left(message_preview.content, 240)
      from messages message_preview
      where message_preview.chat_id = ch.id
        and message_preview.status = 'completed'
      order by message_preview.sequence desc
      limit 1
    ), '') as last_message_preview,
    ch.created_at,
    ch.updated_at,
    ch.last_message_at,
    ch.archived_at
  from chats ch
  join companions c on c.id = ch.companion_id
`;

async function readChatSummary(
  client: PoolClient,
  userId: string,
  chatId: string,
): Promise<ChatSummaryDto | null> {
  const result = await client.query<ChatSummaryRow>(
    `${chatSummarySelect}
      where ch.user_id = $1 and ch.id = $2
      limit 1`,
    [userId, chatId],
  );
  return result.rows[0] ? toChatSummaryDto(result.rows[0]) : null;
}

export async function listChats(
  userId: string,
  options: { companionId?: string; includeArchived?: boolean } = {},
): Promise<ChatSummaryDto[]> {
  const result = await pool.query<ChatSummaryRow>(
    `${chatSummarySelect}
      where ch.user_id = $1
        and ($2::uuid is null or ch.companion_id = $2::uuid)
        and ($3::boolean or ch.archived_at is null)
      order by ch.last_message_at desc, ch.created_at desc`,
    [
      userId,
      options.companionId || null,
      Boolean(options.includeArchived),
    ],
  );

  return result.rows.map(toChatSummaryDto);
}

export async function getChat(
  userId: string,
  chatId: string,
): Promise<ChatDetailDto | null> {
  const client = await pool.connect();
  try {
    const chat = await readChatSummary(client, userId, chatId);
    if (!chat) return null;

    const result = await client.query<MessageRow>(
      `select
         id,
         parent_message_id,
         sequence,
         role,
         content,
         status,
         provider,
         provider_model,
         provider_session_id,
         prompt_version,
         error,
         created_at,
         completed_at
       from messages
       where chat_id = $1
       order by sequence asc`,
      [chatId],
    );

    return {
      ...chat,
      messages: result.rows.map(toMessageDto),
    };
  } finally {
    client.release();
  }
}

export async function createChat(
  userId: string,
  input: CreateChatInput,
): Promise<ChatDetailDto> {
  const client = await pool.connect();
  const chatId = randomUUID();

  try {
    await client.query("begin");

    const companion = await client.query<{ id: string }>(
      `select id
       from companions
       where id = $1 and user_id = $2 and archived_at is null
       limit 1`,
      [input.companionId, userId],
    );

    if (!companion.rows[0]) {
      throw new HttpError("Active companion not found.", 404);
    }

    await client.query(
      `insert into chats (
         id, user_id, companion_id, title, summary, summary_revision
       ) values ($1, $2, $3, $4, '', 0)`,
      [chatId, userId, input.companionId, input.title || "New conversation"],
    );

    await client.query(
      `insert into audit_events (
         id, actor_user_id, action, entity_type, entity_id, metadata
       ) values ($1, $2, 'chat.created', 'chat', $3, $4::jsonb)`,
      [
        randomUUID(),
        userId,
        chatId,
        JSON.stringify({ companionId: input.companionId }),
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const created = await getChat(userId, chatId);
  if (!created) throw new Error("Created chat could not be reloaded.");
  return created;
}

export async function updateChat(
  userId: string,
  chatId: string,
  input: UpdateChatInput,
): Promise<ChatSummaryDto> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const existing = await client.query<{
      id: string;
      title: string;
      archived_at: Date | null;
    }>(
      `select id, title, archived_at
       from chats
       where id = $1 and user_id = $2
       for update`,
      [chatId, userId],
    );

    const chat = existing.rows[0];
    if (!chat) throw new HttpError("Chat not found.", 404);

    const archivedAt =
      input.archived === undefined
        ? chat.archived_at
        : input.archived
          ? new Date()
          : null;

    await client.query(
      `update chats
       set title = $3,
           archived_at = $4,
           updated_at = now()
       where id = $1 and user_id = $2`,
      [chatId, userId, input.title ?? chat.title, archivedAt],
    );

    await client.query(
      `insert into audit_events (
         id, actor_user_id, action, entity_type, entity_id, metadata
       ) values ($1, $2, 'chat.updated', 'chat', $3, $4::jsonb)`,
      [
        randomUUID(),
        userId,
        chatId,
        JSON.stringify({
          titleChanged: input.title !== undefined && input.title !== chat.title,
          archived: Boolean(archivedAt),
        }),
      ],
    );

    const updated = await readChatSummary(client, userId, chatId);
    await client.query("commit");

    if (!updated) throw new Error("Updated chat could not be reloaded.");
    return updated;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function readMessage(
  client: PoolClient,
  messageId: string,
): Promise<ChatMessageDto | null> {
  const result = await client.query<MessageRow>(
    `select
       id,
       parent_message_id,
       sequence,
       role,
       content,
       status,
       provider,
       provider_model,
       provider_session_id,
       prompt_version,
       error,
       created_at,
       completed_at
     from messages
     where id = $1
     limit 1`,
    [messageId],
  );
  return result.rows[0] ? toMessageDto(result.rows[0]) : null;
}

export async function prepareTurn(
  userId: string,
  chatId: string,
  input: SendChatMessageInput,
): Promise<PreparedTurn> {
  const client = await pool.connect();
  const userMessageId = input.clientMessageId;
  let assistantMessageId = randomUUID();

  try {
    await client.query("begin");

    const locked = await client.query<LockedChatRow>(
      `${chatSummarySelect}
       join companion_prompt_versions prompt
         on prompt.companion_id = c.id
        and prompt.version = c.active_prompt_version
       where ch.id = $1 and ch.user_id = $2
       for update of ch`,
      [chatId, userId],
    );

    const baseRow = locked.rows[0];
    if (!baseRow) throw new HttpError("Chat not found.", 404);

    const companionDetails = await client.query<{
      companion_model: string;
      response_style: string;
      memory_mode: string;
      memory_instructions: string;
      prompt_version: number;
      system_prompt: string;
      companion_archived_at: Date | null;
    }>(
      `select
         c.model as companion_model,
         c.response_style,
         c.memory_mode,
         c.memory_instructions,
         c.active_prompt_version as prompt_version,
         prompt.system_prompt,
         c.archived_at as companion_archived_at
       from companions c
       join companion_prompt_versions prompt
         on prompt.companion_id = c.id
        and prompt.version = c.active_prompt_version
       where c.id = $1 and c.user_id = $2
       limit 1`,
      [baseRow.companion_id, userId],
    );

    const details = companionDetails.rows[0];
    if (!details || details.companion_archived_at) {
      throw new HttpError("This companion is archived.", 409);
    }
    if (baseRow.archived_at) {
      throw new HttpError("Restore this chat before sending a message.", 409);
    }

    const existingUser = await client.query<MessageRow & { chat_id: string }>(
      `select
         id,
         chat_id,
         parent_message_id,
         sequence,
         role,
         content,
         status,
         provider,
         provider_model,
         provider_session_id,
         prompt_version,
         error,
         created_at,
         completed_at
       from messages
       where id = $1
       limit 1`,
      [input.clientMessageId],
    );

    const pendingTurn = await client.query<{ id: string }>(
      `select id
       from messages
       where chat_id = $1 and role = 'assistant' and status = 'pending'
       limit 1`,
      [chatId],
    );

    if (!existingUser.rows[0] && pendingTurn.rows[0]) {
      throw new HttpError(
        "Wait for the current response to finish or cancel it first.",
        409,
      );
    }

    let userMessage: ChatMessageDto;
    let assistantMessage: ChatMessageDto;

    if (existingUser.rows[0]) {
      const existing = existingUser.rows[0];
      if (
        existing.chat_id !== chatId ||
        existing.role !== "user" ||
        existing.content !== input.content
      ) {
        throw new HttpError(
          "This client message ID is already used by another message.",
          409,
        );
      }

      userMessage = toMessageDto(existing);
      const assistant = await client.query<MessageRow>(
        `select
           id,
           parent_message_id,
           sequence,
           role,
           content,
           status,
           provider,
           provider_model,
           provider_session_id,
           prompt_version,
           error,
           created_at,
           completed_at
         from messages
         where chat_id = $1 and parent_message_id = $2 and role = 'assistant'
         order by sequence asc
         limit 1`,
        [chatId, input.clientMessageId],
      );

      if (!assistant.rows[0]) {
        if (pendingTurn.rows[0]) {
          throw new HttpError(
            "Wait for the current response to finish or cancel it first.",
            409,
          );
        }

        const sequenceResult = await client.query<{ maximum: number | null }>(
          `select max(sequence)::integer as maximum
           from messages
           where chat_id = $1`,
          [chatId],
        );
        const maximum = Number(sequenceResult.rows[0]?.maximum || 0);
        if (maximum !== Number(existing.sequence)) {
          throw new HttpError(
            "Only the latest incomplete turn can be retried.",
            409,
          );
        }
        const nextSequence = maximum + 1;
        const inserted = await client.query<MessageRow>(
          `insert into messages (
             id, chat_id, parent_message_id, sequence, role, content, status,
             provider, provider_model, prompt_version
           ) values ($1, $2, $3, $4, 'assistant', '', 'pending',
                     'grok-cli-oauth', $5, $6)
           returning
             id, parent_message_id, sequence, role, content, status, provider,
             provider_model, provider_session_id, prompt_version, error,
             created_at, completed_at`,
          [
            assistantMessageId,
            chatId,
            input.clientMessageId,
            nextSequence,
            details.companion_model,
            details.prompt_version,
          ],
        );
        assistantMessage = toMessageDto(inserted.rows[0]);
      } else {
        const existingAssistant = assistant.rows[0];
        assistantMessageId = existingAssistant.id;

        if (existingAssistant.status === "completed") {
          const summary = await readChatSummary(client, userId, chatId);
          await client.query("commit");
          if (!summary) throw new Error("Chat could not be reloaded.");
          return {
            kind: "replay",
            chat: summary,
            userMessage,
            assistantMessage: toMessageDto(existingAssistant),
          };
        }

        if (existingAssistant.status === "pending") {
          throw new HttpError("This message is already being processed.", 409);
        }

        if (pendingTurn.rows[0]) {
          throw new HttpError(
            "Wait for the current response to finish or cancel it first.",
            409,
          );
        }

        const sequenceResult = await client.query<{ maximum: number | null }>(
          `select max(sequence)::integer as maximum
           from messages
           where chat_id = $1`,
          [chatId],
        );
        if (
          Number(sequenceResult.rows[0]?.maximum || 0) !==
          Number(existingAssistant.sequence)
        ) {
          throw new HttpError(
            "Only the latest incomplete response can be retried.",
            409,
          );
        }

        const reset = await client.query<MessageRow>(
          `update messages
           set content = '',
               status = 'pending',
               provider = 'grok-cli-oauth',
               provider_model = $3,
               provider_session_id = null,
               prompt_version = $4,
               error = null,
               completed_at = null
           where id = $1 and chat_id = $2
           returning
             id, parent_message_id, sequence, role, content, status, provider,
             provider_model, provider_session_id, prompt_version, error,
             created_at, completed_at`,
          [
            assistantMessageId,
            chatId,
            details.companion_model,
            details.prompt_version,
          ],
        );
        assistantMessage = toMessageDto(reset.rows[0]);
      }
    } else {
      const sequenceResult = await client.query<{ maximum: number | null }>(
        `select max(sequence)::integer as maximum
         from messages
         where chat_id = $1`,
        [chatId],
      );
      const nextSequence = Number(sequenceResult.rows[0]?.maximum || 0) + 1;

      const insertedUser = await client.query<MessageRow>(
        `insert into messages (
           id, chat_id, sequence, role, content, status, completed_at
         ) values ($1, $2, $3, 'user', $4, 'completed', now())
         returning
           id, parent_message_id, sequence, role, content, status, provider,
           provider_model, provider_session_id, prompt_version, error,
           created_at, completed_at`,
        [userMessageId, chatId, nextSequence, input.content],
      );

      const insertedAssistant = await client.query<MessageRow>(
        `insert into messages (
           id, chat_id, parent_message_id, sequence, role, content, status,
           provider, provider_model, prompt_version
         ) values ($1, $2, $3, $4, 'assistant', '', 'pending',
                   'grok-cli-oauth', $5, $6)
         returning
           id, parent_message_id, sequence, role, content, status, provider,
           provider_model, provider_session_id, prompt_version, error,
           created_at, completed_at`,
        [
          assistantMessageId,
          chatId,
          userMessageId,
          nextSequence + 1,
          details.companion_model,
          details.prompt_version,
        ],
      );

      userMessage = toMessageDto(insertedUser.rows[0]);
      assistantMessage = toMessageDto(insertedAssistant.rows[0]);
    }

    const contextRows = await client.query<{
      role: string;
      content: string;
    }>(
      `select role, content
       from messages
       where chat_id = $1
         and status = 'completed'
         and role in ('user', 'assistant')
       order by sequence desc
       limit 50`,
      [chatId],
    );

    const conversation = boundConversationContext(
      contextRows.rows
        .reverse()
        .map((row) => ({
          role: row.role === "assistant" ? "assistant" : "user",
          content: row.content,
        })),
    );

    await client.query(
      `update chats
       set updated_at = now(), last_message_at = now()
       where id = $1 and user_id = $2`,
      [chatId, userId],
    );

    const summary = await readChatSummary(client, userId, chatId);
    await client.query("commit");

    if (!summary) throw new Error("Chat could not be reloaded.");

    return {
      kind: "generate",
      chat: summary,
      userMessage,
      assistantMessage,
      conversation,
      companion: {
        companionName: baseRow.companion_name,
        systemPrompt: details.system_prompt,
        responseStyle: details.response_style,
        memoryMode: details.memory_mode,
        memoryInstructions: details.memory_instructions,
        chatSummary: baseRow.summary,
      },
      model:
        details.companion_model === "auto"
          ? undefined
          : details.companion_model,
      promptVersion: Number(details.prompt_version),
      previousSummary: baseRow.summary,
      userText: input.content,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function completeTurn(
  userId: string,
  chatId: string,
  input: {
    assistantMessageId: string;
    assistantText: string;
    userText: string;
    previousSummary: string;
    providerSessionId: string;
    providerModel: string | null;
    promptVersion: number;
  },
): Promise<{ chat: ChatSummaryDto; assistantMessage: ChatMessageDto }> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const updatedMessage = await client.query<MessageRow>(
      `update messages
       set content = $3,
           status = 'completed',
           provider = 'grok-cli-oauth',
           provider_model = $4,
           provider_session_id = $5,
           prompt_version = $6,
           error = null,
           completed_at = now()
       where id = $1 and chat_id = $2 and status = 'pending'
       returning
         id, parent_message_id, sequence, role, content, status, provider,
         provider_model, provider_session_id, prompt_version, error,
         created_at, completed_at`,
      [
        input.assistantMessageId,
        chatId,
        input.assistantText,
        input.providerModel,
        input.providerSessionId,
        input.promptVersion,
      ],
    );

    if (!updatedMessage.rows[0]) {
      throw new HttpError("The pending assistant message no longer exists.", 409);
    }

    const digest = buildRollingChatDigest(
      input.previousSummary,
      input.userText,
      input.assistantText,
    );
    const title = deriveChatTitle(input.userText);

    const updatedChat = await client.query<{ id: string }>(
      `update chats
       set title = case when title = 'New conversation' then $3 else title end,
           summary = $4,
           summary_revision = summary_revision + 1,
           updated_at = now(),
           last_message_at = now()
       where id = $1 and user_id = $2
       returning id`,
      [chatId, userId, title, digest],
    );

    if (!updatedChat.rows[0]) throw new HttpError("Chat not found.", 404);

    await client.query(
      `insert into audit_events (
         id, actor_user_id, action, entity_type, entity_id, metadata
       ) values ($1, $2, 'chat.message.completed', 'chat', $3, $4::jsonb)`,
      [
        randomUUID(),
        userId,
        chatId,
        JSON.stringify({
          assistantMessageId: input.assistantMessageId,
          promptVersion: input.promptVersion,
          providerModel: input.providerModel,
        }),
      ],
    );

    const chat = await readChatSummary(client, userId, chatId);
    await client.query("commit");

    if (!chat) throw new Error("Completed chat could not be reloaded.");
    return {
      chat,
      assistantMessage: toMessageDto(updatedMessage.rows[0]),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function failTurn(
  userId: string,
  chatId: string,
  input: {
    assistantMessageId: string;
    status: "failed" | "cancelled";
    error: string;
  },
): Promise<ChatMessageDto | null> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const failed = await client.query<MessageRow>(
      `update messages
       set status = $3,
           error = $4,
           completed_at = now()
       where id = $1 and chat_id = $2 and status = 'pending'
       returning
         id, parent_message_id, sequence, role, content, status, provider,
         provider_model, provider_session_id, prompt_version, error,
         created_at, completed_at`,
      [
        input.assistantMessageId,
        chatId,
        input.status,
        input.error.slice(0, 500),
      ],
    );

    await client.query(
      `update chats
       set updated_at = now(), last_message_at = now()
       where id = $1 and user_id = $2`,
      [chatId, userId],
    );

    await client.query(
      `insert into audit_events (
         id, actor_user_id, action, entity_type, entity_id, metadata
       ) values ($1, $2, $3, 'chat', $4, $5::jsonb)`,
      [
        randomUUID(),
        userId,
        input.status === "cancelled"
          ? "chat.message.cancelled"
          : "chat.message.failed",
        chatId,
        JSON.stringify({ assistantMessageId: input.assistantMessageId }),
      ],
    );

    await client.query("commit");
    return failed.rows[0] ? toMessageDto(failed.rows[0]) : null;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
