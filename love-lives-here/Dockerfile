# syntax=docker/dockerfile:1
# ---- deps
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- build
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

# ---- runtime (no dev dependencies, non-root)
FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r llh && useradd -r -g llh llh
COPY --from=build --chown=llh:llh /app/.next/standalone ./
COPY --from=build --chown=llh:llh /app/.next/static ./.next/static
COPY --from=build --chown=llh:llh /app/public ./public
# migration + seed + ops scripts run with tsx from the build stage's node_modules
COPY --from=build --chown=llh:llh /app/node_modules ./ops/node_modules
COPY --from=build --chown=llh:llh /app/scripts ./ops/scripts
COPY --from=build --chown=llh:llh /app/src ./ops/src
COPY --from=build --chown=llh:llh /app/drizzle ./ops/drizzle
COPY --from=build --chown=llh:llh /app/package.json /app/tsconfig.json ./ops/
USER llh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
