# AI Companion engineering guide

## Product boundary

This repository is a personal AI companion application, not an autonomous coding agent. The app owns companion definitions, chat history, memory, provenance, deletion, and access control.

## Architecture rules

- Use the Next.js App Router and strict TypeScript.
- Keep provider-specific code behind an adapter.
- Keep browser code separate from modules that import `node:*`.
- Mark provider route handlers with `runtime = "nodejs"`.
- PostgreSQL will become the canonical store for companions, chats, messages, memories, and provenance.
- The application database, not a model provider, is the source of truth for conversation state.
- Every inferred memory must retain source message references.
- A forgotten memory must be suppressed so background extraction cannot recreate it.

## Grok OAuth rules

- OAuth is provided through the official `@xai-official/grok` device-code flow.
- Never parse or reuse the CLI credential files directly.
- Never reverse-engineer the xAI token exchange.
- Never expose `GROK_HOME`, credential files, API keys, or raw CLI diagnostics to the browser.
- Never use `--always-approve`.
- Companion inference must deny local tools, disable Grok Build memory, disable subagents, and disable web search unless a future user-controlled feature explicitly enables them.
- Grok CLI OAuth is a single-account, persistent-host feature. Do not claim it works on ephemeral serverless functions.

## Development rules

- Do not commit `.env`, `.data`, generated credentials, chat exports, or user content.
- Add route validation before adding a mutation.
- Prefer small domain modules over a generic `utils.ts`.
- Add an ADR when changing authentication, deployment mode, storage, or memory semantics.
- Do not call an unfinished screen or adapter production-ready.
