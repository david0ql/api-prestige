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
# /app/storage no vacío: un volumen nuevo hereda contenido y dueño (usuario app) en el primer montaje.
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/storage/tmp && touch /app/storage/.keep && chown -R app:app /app/storage
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./
USER app
EXPOSE 3300
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=4 CMD wget -qO- http://127.0.0.1:3300/api/health >/dev/null || exit 1
# Aplica migraciones, crea los datos base en una base vacía (o sincroniza roles) y arranca.
CMD ["sh", "-c", "node dist/database/seeds/run-seed.js --init && exec node dist/main"]
