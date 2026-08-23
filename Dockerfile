FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM dependencies AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
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
