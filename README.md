# AI Companion

A private web application for creating multiple AI companions, keeping many conversations with each companion, and recalling source-backed memories across chats.

## Current repository stage

The application now includes:

- Next.js 16 App Router and strict TypeScript
- A single-owner application account enforced by `APP_OWNER_EMAIL`
- Better Auth email/password sessions stored in PostgreSQL
- PostgreSQL and Drizzle application storage
- Companion create, edit, archive, and restore workflows
- Immutable companion system-prompt versions
- Audit events for companion mutations
- Official Grok Build device-code OAuth
- Safe ACP inference with filesystem, terminal, MCP, web-search, subagent, and Grok-native memory features disabled
- Docker Compose with persistent PostgreSQL and Grok credential volumes

Persistent chats and cross-chat memory are the next milestones.

## Authentication boundaries

AI Companion has two separate authentication layers:

1. **Application owner session.** Better Auth protects the UI, companion data, and every application API. Only the normalized email in `APP_OWNER_EMAIL` may perform the one-time account setup or sign in.
2. **Grok provider session.** The server runs the official `grok login --device-auth` flow and lets Grok Build own its cached OAuth tokens beneath `GROK_HOME`.

The app never reads or copies Grok OAuth tokens. Connecting Grok does not create an application session, and signing into AI Companion does not connect Grok.

## Local setup

Prerequisites:

- Node.js 22.12 or newer
- npm 10 or newer
- PostgreSQL 16 or newer, with PostgreSQL 18 used by the included Compose file
- A Grok account with Grok Build access

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Set at least these values before migration:

```env
DATABASE_URL=postgresql://ai_companion:ai_companion@127.0.0.1:5432/ai_companion
BETTER_AUTH_URL=http://127.0.0.1:3000
BETTER_AUTH_SECRET=replace-with-a-unique-random-secret-of-at-least-32-characters
APP_OWNER_EMAIL=you@example.com
```

Then:

1. Open `http://127.0.0.1:3000/sign-in`.
2. Create the one permitted owner account.
3. Open **Providers** and complete Grok device authorization.
4. Open **Companions** and create distinct companion identities.

Public registration is not supported. If the database already contains a different user than `APP_OWNER_EMAIL`, setup deliberately stops rather than guessing which account owns the deployment.

## Docker setup

Create a `.env` file containing a strong `BETTER_AUTH_SECRET`, your `APP_OWNER_EMAIL`, and optionally a stronger `POSTGRES_PASSWORD`, then run:

```bash
docker compose up --build
```

The application waits for PostgreSQL, applies Better Auth and Drizzle migrations, and binds only to `127.0.0.1:3000` by default.

Persistent volumes retain:

- PostgreSQL data
- Grok Build OAuth session data
- The isolated Grok runtime workspace

## Companion behavior

Each companion currently stores:

- Name, description, and optional avatar URL
- Preferred Grok model identifier
- Response style
- Memory mode and memory instructions
- Active system prompt version
- Archive state

Changing the system prompt appends a new immutable version. Existing versions remain inspectable and can later be referenced by individual assistant messages.

Memory modes are:

- `isolated`: companion-only memory
- `shared_profile`: global user profile plus companion-specific memory
- `shared_all`: all explicitly permitted companion memories

The memory engine is not implemented yet; these settings define the policy boundary that the later retrieval layer must obey.

## Useful commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run check
npm run db:generate
npm run db:migrate
```

`npm run db:migrate` first applies Better Auth migrations, then applies committed Drizzle migrations.

## Deployment modes

| Mode | Grok authentication | Host requirement | Intended use |
|---|---|---|---|
| Self-hosted personal | Official CLI device OAuth | Persistent Node process, child processes, disk, PostgreSQL | Primary MVP |
| Cloud application | xAI API key or encrypted user key | Conventional Node host | Later |
| Multi-user xAI OAuth | Not implemented | Requires a public xAI app contract | Do not claim support |

The CLI OAuth mode is not suitable for Vercel Functions or other ephemeral serverless runtimes.

## Documents

- [`SPEC.md`](./SPEC.md): MVP product and technical contract
- [`ROADMAP.md`](./ROADMAP.md): staged implementation plan
- [`docs/adr/0001-grok-auth-and-deployment.md`](./docs/adr/0001-grok-auth-and-deployment.md): Grok OAuth and hosting decision
- [`docs/adr/0002-identity-storage-and-companions.md`](./docs/adr/0002-identity-storage-and-companions.md): owner identity, PostgreSQL, and prompt versioning

## Security status

The application now requires the configured owner session and revalidates it inside data and provider APIs. Keep the service on loopback or behind an authenticated reverse proxy until rate-limit persistence, backup procedures, account recovery, and full operational hardening are complete.
