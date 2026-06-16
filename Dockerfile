FROM node:22-slim AS base

# Build stage
FROM base AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/.output .output
COPY --from=build /app/package.json .
COPY --from=build /app/package-lock.json .
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts .
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/server ./server
COPY --from=build /app/tsconfig.json .
RUN chmod +x /app/scripts/start.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["sh", "-c", "/app/scripts/start.sh"]
