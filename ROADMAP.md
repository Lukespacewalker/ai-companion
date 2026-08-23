# Roadmap

## Milestone 1: Provider foundation

Status: **complete**

- Next.js application shell
- Grok device-code OAuth
- Persistent Grok CLI runtime
- Safe ACP connection test
- Docker packaging
- CI
- Authentication/deployment ADR

Exit condition met: a persistent local instance can connect, retain, test, and disconnect a Grok session without exposing coding-agent tools.

## Milestone 2: Application identity and storage

Status: **complete in PR #2**

- PostgreSQL
- Better Auth
- Single-owner allowlist
- Protected pages and APIs
- Official Better Auth migrations
- Drizzle application migrations
- Audit events
- Docker Compose database

Exit condition: the configured owner can complete one-time setup, sign in, and reach a private application shell. All mutable routes validate the owner session.

## Milestone 3: Companions

Status: **complete in PR #2**

- Companion create, read, edit, archive, and restore
- Guided prompt editor
- Model and response-style settings
- Memory modes and instructions
- Immutable prompt versions
- Prompt-history viewer
- Optimistic edit conflict detection
- Audit records

Exit condition: two companions can retain observably different identities, and every prompt edit creates a numbered historical version.

## Milestone 4: Multi-chat conversation

Status: **next**

- Chat and message schema
- Multiple threads under each companion
- Grok streaming route
- Abort and retry
- Branching/edit semantics
- Automatic titles
- Current-chat summaries
- Usage records

Exit condition: each companion supports multiple independent conversations across application restarts.

## Milestone 5: Cross-chat memory

- Structured candidate extraction
- Provenance
- Confirmation workflow
- Global and companion scopes
- Retrieval ranking
- Source chips
- Contradiction and supersession handling
- Forget suppression

Exit condition: a fact from one chat can be correctly recalled in another permitted chat, traced to its source, corrected, and genuinely forgotten.

## Milestone 6: Hardening

- Passkeys or two-factor authentication
- Password recovery
- Full export and deletion
- Provider API-key fallback
- Backup and restore
- Memory-quality evaluation set
- Cross-companion leakage tests
- Operational metrics
- Accessibility and mobile review

Exit condition: all acceptance tests in `SPEC.md` pass.
