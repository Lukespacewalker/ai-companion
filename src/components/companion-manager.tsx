"use client";

import { useMemo, useState, type FormEvent } from "react";
import type {
  CompanionDraft,
  CompanionDto,
  PromptVersionDto,
} from "@/features/companions/types";
import {
  memoryModes,
  responseStyles,
} from "@/features/companions/types";

const emptyDraft: CompanionDraft = {
  name: "",
  description: "",
  avatarUrl: "",
  model: "auto",
  responseStyle: "balanced",
  memoryMode: "shared_profile",
  memoryInstructions: "",
  systemPrompt:
    "You are a thoughtful personal AI companion. Be honest, warm, practical, and clear about uncertainty.",
};

function toDraft(companion: CompanionDto): CompanionDraft {
  return {
    name: companion.name,
    description: companion.description,
    avatarUrl: companion.avatarUrl,
    model: companion.model,
    responseStyle: companion.responseStyle,
    memoryMode: companion.memoryMode,
    memoryInstructions: companion.memoryInstructions,
    systemPrompt: companion.systemPrompt,
  };
}

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

function memoryLabel(value: CompanionDto["memoryMode"]): string {
  return {
    isolated: "Isolated",
    shared_profile: "Shared profile",
    shared_all: "Shared all",
  }[value];
}

export function CompanionManager({ initial }: { initial: CompanionDto[] }) {
  const [companions, setCompanions] = useState(initial);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<CompanionDraft>(emptyDraft);
  const [showArchived, setShowArchived] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [history, setHistory] = useState<Record<string, PromptVersionDto[]>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      companions.filter(
        (companion) => showArchived || !companion.archivedAt,
      ),
    [companions, showArchived],
  );

  const editing =
    editingId && editingId !== "new"
      ? companions.find((companion) => companion.id === editingId) || null
      : null;

  function startCreate() {
    setDraft(emptyDraft);
    setEditingId("new");
    setNotice(null);
  }

  function startEdit(companion: CompanionDto) {
    setDraft(toDraft(companion));
    setEditingId(companion.id);
    setNotice(null);
  }

  function patchDraft<K extends keyof CompanionDraft>(
    key: K,
    value: CompanionDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    const creating = editingId === "new";
    if (!creating && !editing) {
      setNotice({ kind: "error", text: "Reload before editing this companion." });
      return;
    }

    setPending(true);
    setNotice(null);

    try {
      const result = creating
        ? await requestJson<{ companion: CompanionDto }>("/api/companions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
          })
        : await requestJson<{ companion: CompanionDto }>(
            `/api/companions/${editingId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...draft,
                expectedPromptVersion: editing!.promptVersion,
              }),
            },
          );

      setCompanions((current) =>
        creating
          ? [result.companion, ...current]
          : current.map((item) =>
              item.id === result.companion.id ? result.companion : item,
            ),
      );
      setHistory((current) => {
        const next = { ...current };
        delete next[result.companion.id];
        return next;
      });
      setEditingId(null);
      setNotice({
        kind: "success",
        text: creating
          ? `${result.companion.name} is ready for a first conversation.`
          : `${result.companion.name} was updated. Prompt changes were versioned.`,
      });
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setPending(false);
    }
  }

  async function setArchived(companion: CompanionDto, archived: boolean) {
    if (
      archived &&
      !window.confirm(`Archive ${companion.name}? Existing data will be kept.`)
    ) {
      return;
    }
    setPending(true);
    setNotice(null);

    try {
      const result = archived
        ? await requestJson<{ companion: CompanionDto }>(
            `/api/companions/${companion.id}?version=${companion.promptVersion}`,
            { method: "DELETE" },
          )
        : await requestJson<{ companion: CompanionDto }>(
            `/api/companions/${companion.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                archived: false,
                expectedPromptVersion: companion.promptVersion,
              }),
            },
          );

      setCompanions((current) =>
        current.map((item) =>
          item.id === result.companion.id ? result.companion : item,
        ),
      );
      setNotice({
        kind: "success",
        text: archived
          ? `${companion.name} was archived without deleting its history.`
          : `${companion.name} is active again.`,
      });
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setPending(false);
    }
  }

  async function loadHistory(companion: CompanionDto) {
    if (history[companion.id]) return;
    setHistoryLoading(companion.id);
    try {
      const result = await requestJson<{ versions: PromptVersionDto[] }>(
        `/api/companions/${companion.id}/prompt-versions`,
      );
      setHistory((current) => ({
        ...current,
        [companion.id]: result.versions,
      }));
    } catch (error) {
      setNotice({ kind: "error", text: (error as Error).message });
    } finally {
      setHistoryLoading(null);
    }
  }

  return (
    <div className="companion-workspace">
      <section className="companion-toolbar">
        <div>
          <strong>
            {companions.filter((item) => !item.archivedAt).length} active
          </strong>
          <span>
            {companions.length} total companion
            {companions.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="actions">
          <label className="compact-toggle">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
          </label>
          <button className="button primary" type="button" onClick={startCreate}>
            New companion
          </button>
        </div>
      </section>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          {notice.text}
        </div>
      )}

      {editingId && (
        <section className="companion-editor">
          <div className="editor-heading">
            <div>
              <div className="eyebrow">
                {editingId === "new" ? "Create identity" : "Edit identity"}
              </div>
              <h2>
                {editingId === "new" ? "New companion" : `Edit ${editing?.name}`}
              </h2>
            </div>
            <button
              className="button ghost small"
              type="button"
              onClick={() => setEditingId(null)}
            >
              Close
            </button>
          </div>

          <form className="companion-form" onSubmit={save}>
            <div className="form-grid two">
              <label className="field">
                <span>Name</span>
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={draft.name}
                  onChange={(event) => patchDraft("name", event.target.value)}
                  placeholder="Luma"
                />
              </label>
              <label className="field">
                <span>Model</span>
                <input
                  required
                  maxLength={120}
                  value={draft.model}
                  onChange={(event) => patchDraft("model", event.target.value)}
                  placeholder="auto"
                />
              </label>
            </div>

            <label className="field">
              <span>Description</span>
              <textarea
                rows={2}
                maxLength={500}
                value={draft.description}
                onChange={(event) =>
                  patchDraft("description", event.target.value)
                }
                placeholder="A practical planning companion who keeps the day calm and concrete."
              />
            </label>

            <label className="field">
              <span>
                Avatar URL <small>optional</small>
              </span>
              <input
                type="url"
                maxLength={2048}
                value={draft.avatarUrl}
                onChange={(event) => patchDraft("avatarUrl", event.target.value)}
                placeholder="https://…"
              />
            </label>

            <div className="form-grid two">
              <label className="field">
                <span>Response style</span>
                <select
                  value={draft.responseStyle}
                  onChange={(event) =>
                    patchDraft(
                      "responseStyle",
                      event.target.value as CompanionDraft["responseStyle"],
                    )
                  }
                >
                  {responseStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Memory boundary</span>
                <select
                  value={draft.memoryMode}
                  onChange={(event) =>
                    patchDraft(
                      "memoryMode",
                      event.target.value as CompanionDraft["memoryMode"],
                    )
                  }
                >
                  {memoryModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {memoryLabel(mode)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field">
              <span>System prompt</span>
              <textarea
                required
                rows={10}
                minLength={20}
                maxLength={24_000}
                value={draft.systemPrompt}
                onChange={(event) =>
                  patchDraft("systemPrompt", event.target.value)
                }
              />
              <small>
                Saving a changed prompt creates a new immutable version instead of
                overwriting history.
              </small>
            </label>

            <label className="field">
              <span>Memory instructions</span>
              <textarea
                rows={4}
                maxLength={4_000}
                value={draft.memoryInstructions}
                onChange={(event) =>
                  patchDraft("memoryInstructions", event.target.value)
                }
                placeholder="Remember durable preferences and decisions. Ask before storing sensitive health or financial details."
              />
            </label>

            <div className="actions editor-actions">
              <button className="button primary" type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : editingId === "new"
                    ? "Create companion"
                    : "Save version"}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {!visible.length ? (
        <section className="empty-state">
          <span className="empty-glyph" aria-hidden="true">
            ✦
          </span>
          <h2>
            {companions.length
              ? "No active companions"
              : "Create your first companion"}
          </h2>
          <p>
            Define a distinct voice, system prompt, model preference, and memory
            boundary. The app will keep every prompt revision traceable.
          </p>
          <button className="button primary" type="button" onClick={startCreate}>
            Create companion
          </button>
        </section>
      ) : (
        <section className="companion-grid" aria-label="Companions">
          {visible.map((companion) => (
            <article
              className={`companion-card ${companion.archivedAt ? "archived" : ""}`}
              key={companion.id}
            >
              <header>
                <span className="companion-avatar" aria-hidden="true">
                  {companion.name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <div className="card-title-line">
                    <h2>{companion.name}</h2>
                    {companion.archivedAt && (
                      <span className="state-chip">Archived</span>
                    )}
                  </div>
                  <p>{companion.description || "No description yet."}</p>
                </div>
              </header>

              <dl className="companion-facts">
                <div>
                  <dt>Model</dt>
                  <dd>{companion.model}</dd>
                </div>
                <div>
                  <dt>Style</dt>
                  <dd>{companion.responseStyle}</dd>
                </div>
                <div>
                  <dt>Memory</dt>
                  <dd>{memoryLabel(companion.memoryMode)}</dd>
                </div>
                <div>
                  <dt>Prompt</dt>
                  <dd>v{companion.promptVersion}</dd>
                </div>
              </dl>

              <div className="prompt-preview">{companion.systemPrompt}</div>

              <div className="actions card-actions">
                <button
                  className="button secondary small"
                  type="button"
                  onClick={() => startEdit(companion)}
                >
                  Edit
                </button>
                <button
                  className="button ghost small"
                  type="button"
                  disabled={historyLoading === companion.id}
                  onClick={() => void loadHistory(companion)}
                >
                  {historyLoading === companion.id
                    ? "Loading…"
                    : "Prompt history"}
                </button>
                <button
                  className="button ghost small"
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    void setArchived(companion, !companion.archivedAt)
                  }
                >
                  {companion.archivedAt ? "Restore" : "Archive"}
                </button>
              </div>

              {history[companion.id] && (
                <div className="prompt-history">
                  {history[companion.id].map((version) => (
                    <details
                      key={version.id}
                      open={version.version === companion.promptVersion}
                    >
                      <summary>
                        Version {version.version}
                        <span>{new Date(version.createdAt).toLocaleString()}</span>
                      </summary>
                      <pre>{version.systemPrompt}</pre>
                    </details>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
