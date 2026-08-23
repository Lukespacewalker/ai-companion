FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM dependencies AS builder
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_URL=http://127.0.0.1:3000
ENV BETTER_AUTH_SECRET=build-only-secret-do-not-use-at-runtime-123456789
ENV APP_OWNER_EMAIL=owner@example.invalid
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV GROK_HOME=/data/grok
ENV COMPANION_RUNTIME_DIR=/data/runtime

COPY --from=builder --chown=node:node /app /app
RUN mkdir -p /data/grok /data/runtime \
  && chown -R node:node /data/grok /data/runtime

USER node
EXPOSE 3000

CMD ["npm", "run", "start:container"]
