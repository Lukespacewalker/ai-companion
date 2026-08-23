"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  ChatCompanionOption,
  ChatDetailDto,
  ChatMessageDto,
  ChatStreamEvent,
  ChatSummaryDto,
} from "@/features/chats/types";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return body;
}

function updateSummaryList(
  chats: ChatSummaryDto[],
  next: ChatSummaryDto,
): ChatSummaryDto[] {
  const remaining = chats.filter((chat) => chat.id !== next.id);
  return [next, ...remaining].sort(
    (left, right) =>
      new Date(right.lastMessageAt).getTime() -
      new Date(left.lastMessageAt).getTime(),
  );
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) return null;
  return JSON.parse(data) as ChatStreamEvent;
}

export function ChatWorkspace({
  initialCompanions,
  initialChats,
  initialChat,
  initialCompanionId,
}: {
  initialCompanions: ChatCompanionOption[];
  initialChats: ChatSummaryDto[];
  initialChat: ChatDetailDto | null;
  initialCompanionId: string;
}) {
  const [chats, setChats] = useState(initialChats);
  const [activeChat, setActiveChat] = useState(initialChat);
  const [selectedCompanionId, setSelectedCompanionId] = useState(
    initialCompanionId,
  );
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState("");
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeSend, setActiveSend] = useState<{
    chatId: string;
    clientMessageId: string;
    assistantMessageId: string;
    controller: AbortController;
  } | null>(null);
  const [notice, setNotice] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedCompanion = initialCompanions.find(
    (companion) => companion.id === selectedCompanionId,
  );

  const visibleChats = useMemo(
    () =>
      chats.filter(
        (chat) =>
          chat.companionId === selectedCompanionId &&
          (showArchived || !chat.archivedAt),
      ),
    [chats, selectedCompanionId, showArchived],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [activeChat?.messages]);

  function replaceActiveMessages(
    chatId: string,
    update: (messages: ChatMessageDto[]) => ChatMessageDto[],
  ) {
    setActiveChat((current) =>
      current && current.id === chatId
        ? { ...current, messages: update(current.messages) }
        : current,
    );
  }

  function applyChatSummary(summary: ChatSummaryDto) {
    setChats((current) => updateSummaryList(current, summary));
    setActiveChat((current) =>
      current && current.id === summary.id
        ? { ...current, ...summary }
        : current,
    );
  }

  async function loadChat(chatId: string) {
    if (activeSend || chatId === activeChat?.id) return;
    setLoadingChatId(chatId);
    setNotice(null);

    try {
      const result = await requestJson<{ chat: ChatDetailDto }>(
        `/api/chats/${chatId}`,
      );
      setActiveChat(result.chat);
      setSelectedCompanionId(result.chat.companionId);
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setLoadingChatId(null);
    }
  }

  function selectCompanion(companionId: string) {
    if (activeSend) return;
    setSelectedCompanionId(companionId);
    setNotice(null);

    const next = chats.find(
      (chat) => chat.companionId === companionId && !chat.archivedAt,
    );

    if (next) {
      void loadChat(next.id);
    } else {
      setActiveChat(null);
    }
  }

  async function createNewChat(): Promise<ChatDetailDto | null> {
    if (!selectedCompanionId || creating || activeSend) return null;
    setCreating(true);
    setNotice(null);

    try {
      const result = await requestJson<{ chat: ChatDetailDto }>("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companionId: selectedCompanionId }),
      });
      setChats((current) => updateSummaryList(current, result.chat));
      setActiveChat(result.chat);
      return result.chat;
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function renameChat(chat: ChatDetailDto) {
    const title = window.prompt("Conversation title", chat.title)?.trim();
    if (!title || title === chat.title || activeSend) return;

    try {
      const result = await requestJson<{ chat: ChatSummaryDto }>(
        `/api/chats/${chat.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      applyChatSummary(result.chat);
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  }

  async function setArchived(chat: ChatSummaryDto, archived: boolean) {
    if (activeSend) return;
    if (
      archived &&
      !window.confirm(`Archive “${chat.title}”? Messages will be kept.`)
    ) {
      return;
    }

    try {
      const result = archived
        ? await requestJson<{ chat: ChatSummaryDto }>(`/api/chats/${chat.id}`, {
            method: "DELETE",
          })
        : await requestJson<{ chat: ChatSummaryDto }>(`/api/chats/${chat.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archived: false }),
          });

      applyChatSummary(result.chat);

      if (archived && activeChat?.id === chat.id && !showArchived) {
        const next = chats.find(
          (candidate) =>
            candidate.id !== chat.id &&
            candidate.companionId === selectedCompanionId &&
            !candidate.archivedAt,
        );
        if (next) void loadChat(next.id);
        else setActiveChat(null);
      }

      setNotice({
        kind: "success",
        text: archived
          ? "Conversation archived without deleting its messages."
          : "Conversation restored.",
      });
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    }
  }

  async function consumeStream(
    response: Response,
    chatId: string,
    clientMessageId: string,
    optimisticAssistantId: string,
  ): Promise<void> {
    if (!response.body) throw new Error("The server returned no response stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let terminal = false;

    while (true) {
      const result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      let boundary = buffer.indexOf("\n\n");

      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");

        const event = parseSseBlock(block);
        if (!event) continue;

        if (event.type === "accepted") {
          applyChatSummary(event.value.chat);
          replaceActiveMessages(chatId, (messages) => {
            const withoutOptimistic = messages.filter(
              (message) =>
                message.id !== clientMessageId &&
                message.id !== optimisticAssistantId,
            );
            return [
              ...withoutOptimistic,
              event.value.userMessage,
              event.value.assistantMessage,
            ].sort((left, right) => left.sequence - right.sequence);
          });
          setActiveSend((current) =>
            current && current.clientMessageId === clientMessageId
              ? {
                  ...current,
                  assistantMessageId: event.value.assistantMessage.id,
                }
              : current,
          );
        } else if (event.type === "delta") {
          replaceActiveMessages(chatId, (messages) =>
            messages.map((message) =>
              message.id === event.assistantMessageId
                ? {
                    ...message,
                    content: `${message.content}${event.delta}`,
                    status: "pending",
                  }
                : message,
            ),
          );
        } else if (event.type === "complete") {
          terminal = true;
          applyChatSummary(event.chat);
          replaceActiveMessages(chatId, (messages) =>
            messages.map((message) =>
              message.id === event.assistantMessage.id
                ? event.assistantMessage
                : message,
            ),
          );
        } else if (event.type === "error") {
          terminal = true;
          replaceActiveMessages(chatId, (messages) =>
            messages.map((message) =>
              message.id === event.assistantMessageId ||
              message.id === optimisticAssistantId
                ? {
                    ...message,
                    id: event.assistantMessageId,
                    status: event.status,
                    error: event.message,
                  }
                : message,
            ),
          );
          setNotice({ kind: "error", text: event.message });
        }
      }
    }

    if (!terminal) {
      throw new Error("The response stream ended before completion.");
    }
  }

  async function sendTurn({
    chat,
    content,
    clientMessageId,
    retryAssistantId,
  }: {
    chat: ChatDetailDto;
    content: string;
    clientMessageId: string;
    retryAssistantId?: string;
  }) {
    if (activeSend) return;

    const controller = new AbortController();
    const optimisticAssistantId =
      retryAssistantId || `pending-${clientMessageId}`;
    const lastSequence = chat.messages.reduce(
      (maximum, message) => Math.max(maximum, message.sequence),
      0,
    );

    if (retryAssistantId) {
      replaceActiveMessages(chat.id, (messages) =>
        messages.map((message) =>
          message.id === retryAssistantId
            ? {
                ...message,
                content: "",
                status: "pending",
                error: null,
                completedAt: null,
              }
            : message,
        ),
      );
    } else {
      const createdAt = new Date().toISOString();
      const optimisticUser: ChatMessageDto = {
        id: clientMessageId,
        parentMessageId: null,
        sequence: lastSequence + 1,
        role: "user",
        content,
        status: "completed",
        provider: null,
        providerModel: null,
        providerSessionId: null,
        promptVersion: null,
        error: null,
        createdAt,
        completedAt: createdAt,
      };
      const optimisticAssistant: ChatMessageDto = {
        id: optimisticAssistantId,
        parentMessageId: clientMessageId,
        sequence: lastSequence + 2,
        role: "assistant",
        content: "",
        status: "pending",
        provider: "grok-cli-oauth",
        providerModel: null,
        providerSessionId: null,
        promptVersion: null,
        error: null,
        createdAt,
        completedAt: null,
      };

      replaceActiveMessages(chat.id, (messages) => [
        ...messages,
        optimisticUser,
        optimisticAssistant,
      ]);
    }

    setActiveSend({
      chatId: chat.id,
      clientMessageId,
      assistantMessageId: optimisticAssistantId,
      controller,
    });
    setNotice(null);

    try {
      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientMessageId, content }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `Request failed (${response.status}).`);
      }

      await consumeStream(
        response,
        chat.id,
        clientMessageId,
        optimisticAssistantId,
      );
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const message = cancelled
        ? "Response generation was cancelled."
        : (error as Error).message;

      replaceActiveMessages(chat.id, (messages) =>
        messages.map((item) =>
          item.id === optimisticAssistantId ||
          (item.parentMessageId === clientMessageId && item.role === "assistant")
            ? {
                ...item,
                status: cancelled ? "cancelled" : "failed",
                error: message,
              }
            : item,
        ),
      );
      if (!cancelled) setNotice({ kind: "error", text: message });
    } finally {
      setActiveSend((current) =>
        current?.clientMessageId === clientMessageId ? null : current,
      );
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || activeSend) return;

    let chat = activeChat;
    if (!chat || chat.archivedAt) chat = await createNewChat();
    if (!chat) return;

    setDraft("");
    await sendTurn({
      chat,
      content,
      clientMessageId: crypto.randomUUID(),
    });
  }

  function composerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function stopGeneration() {
    if (!activeSend) return;
    activeSend.controller.abort();
    replaceActiveMessages(activeSend.chatId, (messages) =>
      messages.map((message) =>
        message.id === activeSend.assistantMessageId ||
        message.parentMessageId === activeSend.clientMessageId
          ? {
              ...message,
              status: message.role === "assistant" ? "cancelled" : message.status,
              error:
                message.role === "assistant"
                  ? "Response generation was cancelled."
                  : message.error,
            }
          : message,
      ),
    );
  }

  function retryMessage(assistant: ChatMessageDto) {
    if (!activeChat || !assistant.parentMessageId || activeSend) return;
    const user = activeChat.messages.find(
      (message) => message.id === assistant.parentMessageId,
    );
    if (!user) return;

    void sendTurn({
      chat: activeChat,
      content: user.content,
      clientMessageId: user.id,
      retryAssistantId: assistant.id,
    });
  }

  if (!initialCompanions.length) {
    return (
      <section className="empty-state">
        <span className="empty-glyph" aria-hidden="true">
          ✦
        </span>
        <h2>Create a companion first</h2>
        <p>
          Conversations belong to a versioned companion identity. Give one a name,
          system prompt, and memory boundary before opening the chat room.
        </p>
        <Link className="button primary" href="/companions">
          Open companions
        </Link>
      </section>
    );
  }

  return (
    <section className="chat-workspace">
      <aside className="chat-sidebar">
        <div className="chat-sidebar-heading">
          <div>
            <div className="eyebrow">Conversation library</div>
            <h2>Chats</h2>
          </div>
          <button
            className="button primary small"
            type="button"
            disabled={creating || Boolean(activeSend)}
            onClick={() => void createNewChat()}
          >
            {creating ? "Creating…" : "New"}
          </button>
        </div>

        <label className="field chat-companion-select">
          <span>Companion</span>
          <select
            value={selectedCompanionId}
            disabled={Boolean(activeSend)}
            onChange={(event) => selectCompanion(event.target.value)}
          >
            {initialCompanions.map((companion) => (
              <option key={companion.id} value={companion.id}>
                {companion.name}
              </option>
            ))}
          </select>
        </label>

        <label className="compact-toggle chat-archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>

        <div className="chat-list" role="list">
          {visibleChats.length ? (
            visibleChats.map((chat) => (
              <article
                className={`chat-list-item ${
                  activeChat?.id === chat.id ? "active" : ""
                } ${chat.archivedAt ? "archived" : ""}`}
                key={chat.id}
                role="listitem"
              >
                <button
                  className="chat-list-select"
                  type="button"
                  disabled={Boolean(activeSend)}
                  onClick={() => void loadChat(chat.id)}
                >
                  <strong>{chat.title}</strong>
                  <span>
                    {chat.lastMessagePreview || "No messages yet. Start here."}
                  </span>
                  <small>
                    {chat.messageCount} messages · {displayDate(chat.lastMessageAt)}
                  </small>
                </button>
                <button
                  className="chat-list-archive"
                  type="button"
                  disabled={Boolean(activeSend)}
                  title={chat.archivedAt ? "Restore conversation" : "Archive conversation"}
                  aria-label={
                    chat.archivedAt
                      ? `Restore ${chat.title}`
                      : `Archive ${chat.title}`
                  }
                  onClick={() => void setArchived(chat, !chat.archivedAt)}
                >
                  {chat.archivedAt ? "↥" : "×"}
                </button>
              </article>
            ))
          ) : (
            <div className="chat-list-empty">
              <strong>No conversations</strong>
              <span>Open a new thread with {selectedCompanion?.name}.</span>
            </div>
          )}
        </div>
      </aside>

      <div className="chat-stage">
        {notice && (
          <div className={`notice ${notice.kind}`} role="status">
            {notice.text}
          </div>
        )}

        {activeChat ? (
          <>
            <header className="chat-stage-header">
              <div className="chat-stage-identity">
                <span className="companion-avatar" aria-hidden="true">
                  {activeChat.companionName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <div className="eyebrow">{activeChat.companionName}</div>
                  <h1>{activeChat.title}</h1>
                  <p>
                    {activeChat.messageCount} messages · digest revision {activeChat.summaryRevision}
                  </p>
                </div>
              </div>
              <div className="actions">
                <button
                  className="button ghost small"
                  type="button"
                  disabled={Boolean(activeSend)}
                  onClick={() => void renameChat(activeChat)}
                >
                  Rename
                </button>
                <button
                  className="button ghost small"
                  type="button"
                  disabled={Boolean(activeSend)}
                  onClick={() =>
                    void setArchived(activeChat, !activeChat.archivedAt)
                  }
                >
                  {activeChat.archivedAt ? "Restore" : "Archive"}
                </button>
              </div>
            </header>

            <div className="message-thread" aria-live="polite">
              {loadingChatId === activeChat.id ? (
                <div className="thread-placeholder">Loading conversation…</div>
              ) : activeChat.messages.length ? (
                activeChat.messages.map((message) => (
                  <article
                    className={`chat-message ${message.role} ${message.status}`}
                    key={message.id}
                  >
                    <div className="message-meta">
                      <strong>
                        {message.role === "user"
                          ? "You"
                          : activeChat.companionName}
                      </strong>
                      <span>
                        {displayDate(message.createdAt)}
                        {message.promptVersion
                          ? ` · prompt v${message.promptVersion}`
                          : ""}
                      </span>
                    </div>
                    <div className="message-content">
                      {message.content ||
                        (message.status === "pending"
                          ? "Thinking…"
                          : "No response text was stored.")}
                    </div>
                    {(message.status === "failed" ||
                      message.status === "cancelled") && (
                      <div className="message-error">
                        <span>{message.error || "This response did not complete."}</span>
                        {message.role === "assistant" &&
                          message.parentMessageId && (
                            <button
                              className="button secondary small"
                              type="button"
                              disabled={Boolean(activeSend)}
                              onClick={() => retryMessage(message)}
                            >
                              Retry
                            </button>
                          )}
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <div className="chat-welcome">
                  <span className="empty-glyph" aria-hidden="true">
                    ◌
                  </span>
                  <h2>Begin a new thread with {activeChat.companionName}</h2>
                  <p>
                    This conversation is stored independently. Replies record the
                    exact companion prompt version that generated them.
                  </p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form className="chat-composer" onSubmit={submit}>
              <textarea
                required
                rows={3}
                maxLength={8_000}
                value={draft}
                disabled={Boolean(activeChat.archivedAt)}
                placeholder={
                  activeChat.archivedAt
                    ? "Restore this conversation before replying."
                    : `Message ${activeChat.companionName}…`
                }
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={composerKeyDown}
              />
              <div className="composer-footer">
                <span>{draft.length.toLocaleString()} / 8,000</span>
                {activeSend ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={stopGeneration}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    className="button primary"
                    type="submit"
                    disabled={!draft.trim() || Boolean(activeChat.archivedAt)}
                  >
                    Send
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className="chat-empty-stage">
            <span className="empty-glyph" aria-hidden="true">
              ↗
            </span>
            <div className="eyebrow">{selectedCompanion?.name}</div>
            <h2>Open a fresh conversation</h2>
            <p>
              Chats remain separate while sharing the same versioned companion
              identity. Cross-chat recall arrives in the next memory slice.
            </p>
            <button
              className="button primary"
              type="button"
              disabled={creating}
              onClick={() => void createNewChat()}
            >
              {creating ? "Creating…" : "Start conversation"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
