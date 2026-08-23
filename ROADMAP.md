# Roadmap

## Milestone 1: Provider foundation

Status: in progress in the first feature branch.

- Next.js application shell
- Grok device-code OAuth
- Persistent Grok CLI runtime
- Safe ACP connection test
- Docker packaging
- CI
- Architecture and product specification

Exit condition: a locally hosted instance can connect, restart, retain the Grok session, disconnect, and complete a tool-free test response.

## Milestone 2: Application identity and storage

- PostgreSQL and Drizzle
- Better Auth
- Single-user allowlist
- CSRF and rate limits
- Initial migrations
- Docker Compose database
- Audit events

Exit condition: an authenticated owner can access a private empty dashboard and all data queries are owner-scoped.

## Milestone 3: Companions

- Companion CRUD
- Guided and advanced prompt editor
- Prompt versioning
- Model selection
- Memory modes
- Archive and restore
- Preview conversation

Exit condition: two companions produce observably different behavior and each response records the prompt version.

## Milestone 4: Multi-chat conversation

- Chat and message persistence
- Streaming route
- Abort and retry
- Automatic titles
- Current-chat summaries
- Search
- Usage records

Exit condition: each companion supports multiple independent conversations across restarts.

## Milestone 5: Cross-chat memory

- Structured candidate extraction
- Provenance
- Confirmation workflow
- Global and companion scopes
- Retrieval ranking
- Source chips
- Contradiction and supersession handling
- Forget suppression

Exit condition: a fact from one chat can be correctly recalled in another permitted chat, traced to its source, and genuinely forgotten.

## Milestone 6: Hardening

- Full export and deletion
- Provider API-key fallback
- Backup and restore
- Memory-quality evaluation set
- Cross-companion leakage tests
- Operational metrics
- Deployment guide
- Accessibility and mobile review

Exit condition: all acceptance tests in `SPEC.md` pass.
