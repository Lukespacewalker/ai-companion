# AI Companion

A personal web application for creating multiple AI companions, keeping many conversations with each companion, and recalling source-backed memories across chats.

## Current repository stage

This first foundation implements:

- Next.js 16 App Router shell
- A provider abstraction boundary
- Official Grok Build device-code OAuth connection
- Persistent Grok CLI credential storage for self-hosted deployments
- A safe Grok connection test using ACP
- Explicit denial of filesystem, terminal, MCP, web-search, subagent, and Grok-native memory features
- Same-origin checks on provider mutations while full application authentication is pending
- Docker support with a persistent Grok session volume
- Product specification, roadmap, and architecture decision record

Companion CRUD, chat persistence, PostgreSQL, application login, and the memory engine are intentionally the next milestones. Until application authentication lands, run this only on localhost or behind your own authenticated reverse proxy.

## Why Grok OAuth looks different here

The xAI inference API uses API keys. Grok Build also offers an official browser/device login backed by OAuth/OIDC. This project uses the official CLI as a black box:

1. The server runs `grok login --device-auth`.
2. The UI displays the verification URL and device code.
3. Grok Build stores and refreshes its own session under `GROK_HOME`.
4. The app invokes `grok agent stdio` and selects the CLI's cached-token authentication method.
5. The app never reads or copies the OAuth tokens.

This is suitable for one personal Grok account on a persistent Node host. It is not a multi-tenant OAuth integration and it is not suitable for Vercel Functions or other ephemeral serverless runtimes.

## Local setup

Prerequisites:

- Node.js 22 or newer
- npm 10 or newer
- A Grok account that can authenticate with Grok Build

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://127.0.0.1:3000/settings/providers`, select **Connect Grok**, and finish the device-code flow.

Runtime credentials and temporary files are stored below `.data/` by default and are ignored by Git.

## Docker setup

```bash
docker compose up --build
```

Open `http://127.0.0.1:3000`. The compose file binds only to loopback and persists Grok's session in a named Docker volume.

## Useful commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm run check
```

## Deployment modes

| Mode | Grok authentication | Host requirement | Intended use |
|---|---|---|---|
| Self-hosted personal | Official CLI device OAuth | Persistent Node process and disk | Primary MVP |
| Cloud application | xAI API key or user-supplied encrypted key | Any supported Node host | Later |
| Multi-user OAuth | Not implemented | Requires a public xAI app integration | Do not claim support |

## Documents

- [`SPEC.md`](./SPEC.md): MVP product and technical specification
- [`ROADMAP.md`](./ROADMAP.md): staged implementation plan
- [`docs/adr/0001-grok-auth-and-deployment.md`](./docs/adr/0001-grok-auth-and-deployment.md): Grok OAuth and hosting decision

## Security status

This branch establishes a safer provider boundary, but it does **not** yet include application authentication. Do not expose it directly to the public internet.
