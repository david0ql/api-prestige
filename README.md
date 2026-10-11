# Prestige Gold · API

API del **Sistema Integral de Control de Materiales, Talleres, Producción y Finanzas** de Prestige Gold
(Especificación Funcional v1.1, en `docs/especificacion-v1.1.txt`; trazabilidad en `docs/matriz-cumplimiento.md`).

**NestJS 11 · TypeORM 1.0 · PostgreSQL 17**. Sin SQL crudo: entidades, repositorios, find-options y QueryBuilder.
La web está en [web-prestige](https://github.com/david0ql/web-prestige).

## Puesta en marcha

```bash
cp .env.example .env            # secretos de al menos 32 caracteres en JWT_ACCESS_SECRET y MEDIA_SIGNING_SECRET
npm ci
npm run build
node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
node dist/main                  # http://localhost:3300/api · Swagger en /docs (si SWAGGER_ENABLED)
```

### Carga inicial (solo sobre base vacía)

`POST /api/setup/seed` con la cabecera `X-Setup-Token: $SETUP_TOKEN` crea roles, maestros base, parámetros
(balanza Mettler Toledo MT-SICS) y el usuario `admin` con `SEED_ADMIN_PASSWORD`, que se pide cambiar en el
primer ingreso. Si la base ya tiene datos responde `409` y no modifica nada. `GET /api/setup/status` informa el estado.

## Pruebas

| Comando | Qué valida |
|---|---|
| `npm test` | Unitarias |
| `npm run test:e2e` | E2E contra PostgreSQL real (base `prestige_test`): flujos A/B/C, CA-001…CA-016, reglas, seguridad, rendimiento bajo volumen, carga inicial |

## Seguridad

Argon2id; JWT de acceso en memoria del navegador + refresh rotativo en cookie `httpOnly; SameSite=Strict`
con detección de reuso; bloqueo tras 5 intentos; cambio obligatorio de contraseña inicial; rate limiting; RBAC
con aislamiento por taller; Helmet; CORS con lista blanca; validación estricta; cargas verificadas por firma
binaria y servidas con URLs firmadas; exportaciones protegidas contra inyección de fórmulas.

## Despliegue (servidor con pm2 + nginx)

```bash
npm ci && npm run build
node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
pm2 start dist/main.js --name "QA API Prestige" && pm2 save
```
