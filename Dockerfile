# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- runtime (usuario sin privilegios) ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/storage && chown app:app /app/storage
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./
USER app
EXPOSE 3300
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3300/api/health || exit 1
# Aplica migraciones pendientes y arranca.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js && node dist/main"]
