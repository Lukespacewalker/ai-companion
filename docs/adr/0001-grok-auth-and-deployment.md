# ADR 0001: Grok authentication and deployment boundary

- Status: Accepted
- Date: 2026-08-23

## Context

The product requirement asks the user to connect Grok through OAuth. The xAI inference REST API authenticates with an API key, while the official Grok Build CLI supports browser OIDC and RFC 8628 device-code authentication.

The existing `novel-workspace` repository demonstrates a practical integration by installing `@xai-official/grok`, running `grok login --device-auth`, and communicating with `grok agent stdio`.

That implementation proves the path, but an AI companion needs a stricter boundary than a coding workspace:

- Companion chat must not receive automatic filesystem or terminal access.
- `--always-approve` is inappropriate.
- Device-login child processes must be tracked.
- ACP authentication should explicitly select the CLI-advertised cached token.
- Grok Build's own memory must not compete with the application's inspectable memory.
- The runtime must survive restarts with persistent credential storage.

## Decision

### Primary MVP mode

Use the official Grok Build CLI as a black box on a persistent, single-user Node.js host.

- Start OAuth with `grok login --device-auth`.
- Persist the CLI-owned session under `GROK_HOME`.
- Never read, transform, export, or directly call services with the CLI token.
- Use ACP over stdio for inference.
- Explicitly authenticate ACP with the advertised `cached_token` method.
- Deny local tools and use a dedicated empty working directory.
- Disable Grok-native memory, subagents, and web search.
- Track login and inference child processes and terminate them cleanly.

### Deployment boundary

The OAuth CLI mode is supported only when all of the following are true:

- one personal Grok account per app instance
- persistent Node process
- child-process execution allowed
- private persistent disk available
- application hosted locally or behind application authentication

It is not supported on Vercel Functions or equivalent ephemeral serverless runtimes.

### Future cloud mode

Add an `xai-api-key` adapter without changing companion, chat, or memory domain behavior.

For user-provided keys:

- encrypt at rest with authenticated encryption
- keep plaintext only for the outbound request
- never expose it to the browser
- support key rotation and disconnect

## Consequences

### Positive

- Satisfies the personal OAuth requirement through an official xAI-supported flow.
- Avoids reverse-engineering OAuth endpoints or credential files.
- Allows the user's Grok Build account to own authentication refresh.
- Keeps a clean provider boundary for a later API-key adapter.
- Preserves local control of chats and memories.

### Negative

- One Grok account per running instance.
- Requires persistent self-hosting.
- Child-process startup adds latency.
- Grok Build is an agent runtime, so the app must continuously enforce tool denial.
- This is not a general third-party xAI OAuth integration.

## Rejected alternatives

### Reverse-engineer the CLI token

Rejected. It would create security, compatibility, and support risks.

### Call the xAI inference API with the CLI token

Rejected. The token is owned by the official CLI flow and is not a documented inference API credential.

### Use only an xAI API key

Rejected as the primary MVP path because it does not satisfy the requested OAuth experience. It remains the planned cloud fallback.

### Deploy OAuth CLI mode on serverless functions

Rejected. Ephemeral processes and files conflict with the CLI's login, cached credentials, and ACP lifecycle.
