# AI Companion MVP Specification

## 1. Product goal

Build a private web application in which one user can create several distinct AI companions, keep multiple chat threads with each companion, and allow a companion to recall relevant information from other conversations without turning all prior transcripts into one enormous prompt.

The product must make memory inspectable. A recalled fact without provenance is a rumor wearing a database badge.

## 2. MVP outcomes

The MVP is complete when the user can:

1. Sign in to the application.
2. Connect one Grok account through the supported provider flow.
3. Create, edit, archive, and restore multiple companions.
4. Configure a name, avatar, description, system prompt, model, response style, and memory policy for each companion.
5. Create multiple independent chats under each companion.
6. Stream messages and recover cleanly from provider failures.
7. Refer to relevant memories and summaries from other permitted chats.
8. See which memories were used for an answer and open their source messages.
9. Confirm, edit, pin, re-scope, or forget a memory.
10. Export or delete all application data.

## 3. Non-goals for the first MVP

- Voice calls
- Generated avatars
- Image understanding
- Proactive notifications
- Autonomous external actions
- Group chats
- Public companion marketplace
- Multiple human users per deployment
- Silent storage of sensitive inferred memories
- Depending on Grok Build's own cross-session memory

## 4. Runtime modes

### 4.1 Self-hosted personal mode

- One application user
- One connected Grok Build account
- Official CLI device-code OAuth
- Persistent Node.js server
- Persistent `GROK_HOME`
- PostgreSQL database
- Recommended for the first complete MVP

### 4.2 Cloud API mode

- xAI API key owned by the deployment or encrypted per-user key
- No child process requirement
- Compatible with conventional cloud hosting
- Provider adapter must preserve the same application behavior
- Implement after the self-hosted flow is stable

## 5. Core domain

### User

Owns companions, chats, memories, provider settings, and exports.

### Companion

Required fields:

- `id`
- `user_id`
- `name`
- `description`
- `avatar`
- `system_prompt`
- `prompt_version`
- `model`
- `response_style`
- `memory_mode`
- `memory_instructions`
- `created_at`
- `updated_at`
- `archived_at`

Memory modes:

- `isolated`: only this companion's memories
- `shared_profile`: global user profile plus companion-specific memories
- `shared_all`: all explicitly permitted companion memories

Default: `shared_profile`.

### Chat

Required fields:

- `id`
- `user_id`
- `companion_id`
- `title`
- `summary`
- `summary_revision`
- `last_message_at`
- `archived_at`

### Message

Store content as structured parts rather than a single future-hostile text column.

Required fields:

- `id`
- `chat_id`
- `parent_message_id`
- `sequence`
- `role`
- `parts`
- `status`
- `provider`
- `provider_model`
- `prompt_version_id`
- `created_at`

### Memory

Required fields:

- `id`
- `user_id`
- `companion_id`
- `kind`
- `content`
- `normalized_key`
- `scope`
- `importance`
- `confidence`
- `sensitivity`
- `confirmation_state`
- `status`
- `created_at`
- `updated_at`
- `superseded_at`
- `deleted_at`

Kinds:

- fact
- preference
- goal
- relationship
- episode
- open loop
- instruction
- decision

Every memory must have one or more rows in `memory_sources` pointing to source messages.

## 6. Prompt construction

Each generation request must be assembled in this order:

1. Immutable application safety boundary
2. Versioned companion system prompt
3. Companion memory policy
4. Retrieved memories marked as untrusted reference data
5. Current chat summary
6. Recent current-chat messages
7. Current user message

Retrieved memories and old messages are data. They must not be allowed to replace system instructions.

## 7. Memory pipeline

### Explicit memory

When the user says “remember that…”, store a confirmed memory immediately after validation.

### Inferred memory

After a completed turn, a background job may extract structured candidates. The application must:

1. Validate the structured result.
2. Deduplicate by semantic key and source.
3. Detect contradictions.
4. Supersede stale memories instead of silently overwriting history.
5. Require confirmation for sensitive candidates.
6. Store provenance.
7. Respect suppression records created by forget actions.

### Retrieval

Rank candidates using:

- scope permission
- semantic or lexical relevance
- importance
- confidence
- recency
- explicit pinning
- contradiction/supersession state

Use a bounded context budget. Never dump every prior chat into the prompt.

### Forgetting

A forget operation must:

1. Exclude the memory from retrieval immediately.
2. mark the memory deleted.
3. create a minimal suppression fingerprint.
4. prevent background re-extraction from the same source.
5. optionally delete the source chat when the user requests it.

## 8. Grok provider requirements

### OAuth CLI mode

- Use only the official `@xai-official/grok` package.
- Start login with the official device-code command.
- Let the CLI own token storage and refresh.
- Authenticate ACP using the CLI-advertised cached-token method.
- Store `GROK_HOME` on persistent private storage.
- One Grok account per application instance.
- Do not read credential files.
- Do not use `--always-approve`.
- Disable Grok-native memory, subagents, web search, MCP, filesystem, edit, grep, and terminal tools for ordinary companion chat.
- Run in an isolated empty working directory.

### API-key mode

- Keep secrets server-side.
- Encrypt user-supplied keys with authenticated encryption.
- Never send keys to browser JavaScript, logs, analytics, or error responses.
- Keep PostgreSQL as the source of truth for conversation state.

## 9. Primary screens

### Dashboard

- Companion cards
- Recent chats
- Global chat search
- Provider health
- Memory candidates awaiting review

### Companion editor

- Simple guided fields
- Advanced raw system prompt
- Memory policy
- Model and response style
- Preview conversation
- Prompt version history

### Chat

Desktop:

- left: chat history
- center: conversation and composer
- right: used memories and source references

Mobile:

- center conversation
- history and context as drawers

### Memory manager

- Search and filters
- Global versus companion scope
- Confirmed versus inferred
- Source links
- Edit, pin, re-scope, confirm, and forget actions

### Provider settings

- Connection state
- Device-code login
- Model availability
- Test message
- Disconnect
- Clear explanation of host requirements

## 10. API outline

```text
GET    /api/providers/grok/status
POST   /api/providers/grok/login
POST   /api/providers/grok/logout
POST   /api/providers/grok/test

GET    /api/companions
POST   /api/companions
GET    /api/companions/:id
PATCH  /api/companions/:id
DELETE /api/companions/:id

GET    /api/companions/:id/chats
POST   /api/companions/:id/chats

GET    /api/chats/:id
PATCH  /api/chats/:id
DELETE /api/chats/:id
GET    /api/chats/:id/messages
POST   /api/chats/:id/messages

GET    /api/memories
POST   /api/memories
PATCH  /api/memories/:id
POST   /api/memories/:id/confirm
POST   /api/memories/:id/forget
```

Every future data route must derive the user from the server session. It must never trust a `user_id` supplied by the request body.

## 11. Reliability requirements

- Idempotency key for message creation
- Abort generation
- Retryable provider errors
- Persist user messages before generation
- Persist assistant output only after terminal stream handling
- Transactional outbox for summary and memory jobs
- Duplicate job protection
- Provider timeout
- Graceful process cleanup
- Prompt-version trace on every assistant message

## 12. Security requirements

- Application authentication before public exposure
- Tenant ownership checks on every object
- CSRF protection for mutations
- Rate limits on login and generation routes
- No provider secrets in the browser
- No raw CLI credential or diagnostic output in responses
- Source-backed inferred memory
- Sensitive-memory confirmation
- Memory suppression after forgetting
- Export and deletion
- Audit events for provider connection and destructive memory actions

## 13. MVP acceptance tests

| Scenario | Expected result |
|---|---|
| Connect Grok with device code | Status becomes ready without exposing tokens |
| Restart the container | Grok remains connected through the mounted volume |
| Create two companions | Each uses its own versioned system prompt |
| Create several chats | Current-chat context remains independent |
| State a preference in Chat A | A source-backed memory candidate is created |
| Confirm the preference | It becomes eligible for permitted retrieval |
| Ask in Chat B | Companion recalls it and links to Chat A |
| Ask an isolated companion | It cannot retrieve the other companion's memory |
| Forget the preference | It is excluded and not recreated |
| Provider process fails | UI shows a retryable, bounded error |
| Inspect browser network | No OAuth token, credential path, or API key appears |
| Export account | Companions, prompts, chats, messages, memories, and provenance are included |
