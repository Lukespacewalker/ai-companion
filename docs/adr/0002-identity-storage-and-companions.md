# ADR 0002: Single-owner identity, PostgreSQL, and companion persistence

- Status: Accepted
- Date: 2026-08-23

## Context

The provider foundation established a personal Grok connection, but the application still lacked a human identity boundary and a canonical store for companions. The next layer must protect provider operations, give every companion a durable identity, and preserve prompt history before chats and memory are introduced.

The first deployment is intentionally personal. It needs one owner account, not public registration, organizations, invitations, or a miniature enterprise IAM department hiding inside an MVP.

## Decision

### Application identity

Use Better Auth with its PostgreSQL adapter and email/password authentication.

The deployment defines `APP_OWNER_EMAIL`. The application allows email sign-up only when all of these conditions are true:

1. PostgreSQL and the Better Auth schema are available.
2. No account has already been registered.
3. The requested email exactly matches `APP_OWNER_EMAIL` after normalization.

After setup, every page and application API validates that the active session belongs to the configured owner. A cookie-shaped object is not treated as authorization merely because it arrived wearing a browser hat.

### Provider boundary

Grok OAuth remains separate from application identity. Signing into AI Companion does not sign into Grok, and connecting Grok does not create an AI Companion session.

All Grok status, login, logout, and test routes require the owner session. Mutations also retain same-origin checks.

### Storage

PostgreSQL is the canonical store for identity and application data.

- Better Auth owns its identity tables and migrations.
- Drizzle ORM owns the typed application schema and queries.
- Drizzle migrations are committed and applied independently after Better Auth migrations.
- Application tables carry `user_id` even though this deployment permits one user. This avoids a hazardous tenancy retrofit later.

### Companion model

A companion stores mutable profile fields such as name, description, model preference, response style, and memory policy.

The system prompt is not overwritten. It is stored in `companion_prompt_versions`, and the companion points to an active numbered version. Editing a system prompt appends a new immutable version in the same transaction that updates the companion.

Every create, update, archive, and restore operation writes an audit event.

### Archive semantics

MVP deletion is archive-first. Archiving sets `archived_at` and retains prompts and future chat references. Permanent deletion will be added with export and retention controls after chats exist.

## Consequences

### Positive

- Provider operations are no longer exposed to anonymous visitors.
- Owner onboarding does not require email delivery infrastructure.
- Companion prompts are reproducible and inspectable.
- Future messages can record the exact prompt version used for generation.
- PostgreSQL can support transactionally consistent chats, memories, and provenance.

### Negative

- Device OAuth still requires a persistent self-hosted Node process and disk.
- Email/password recovery is not yet implemented; the owner must protect backups and credentials.
- Better Auth and application migrations are separate commands composed by `npm run db:migrate`.
- The one-owner policy is an intentional product constraint, not multi-user SaaS authentication.

## Rejected alternatives

### Leave the application unauthenticated behind loopback

Loopback binding is valuable but insufficient as the only control. Reverse proxies, tunnels, container changes, and operator mistakes can turn a local assumption into a public incident.

### Use Grok OAuth as application identity

Grok authentication authorizes a model runtime, not the human application session. Coupling them would blur account ownership, make provider replacement harder, and expose provider credentials to unrelated application concerns.

### Store the current system prompt directly on the companion row

Overwriting prompts destroys reproducibility. A response without its generating prompt version is a fossil with the sediment scraped off.
