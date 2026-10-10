/**
 * Configuración tipada de la aplicación. Se carga con @nestjs/config y se valida
 * en `env.validation.ts` al arrancar (fail-fast si falta un secreto).
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string[];
  webUrl: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  jwt: { accessSecret: string; accessTtl: number; refreshTtl: number };
  media: {
    signingSecret: string;
    storageDir: string;
    maxPhotoMb: number;
    maxVideoMb: number;
    urlTtlSec: number;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  security: {
    swaggerEnabled: boolean;
    trustProxy: boolean;
    maxFailedLogins: number;
    lockMinutes: number;
  };
  throttle: { ttlSec: number; limit: number };
  seed: { adminPassword: string };
}

const bool = (v: string | undefined, def: boolean) =>
  v === undefined ? def : ['1', 'true', 'yes'].includes(v.toLowerCase());

export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isTest = nodeEnv === 'test';
  return {
    nodeEnv,
    port: parseInt(process.env.PORT ?? '3300', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5180')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    webUrl: process.env.WEB_URL ?? 'http://localhost:5180',
    database: {
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT ?? '5440', 10),
      user: process.env.DATABASE_USER ?? 'prestige',
      password: process.env.DATABASE_PASSWORD ?? '',
      // En pruebas se usa SIEMPRE la base aislada para no tocar datos reales.
      name: isTest
        ? (process.env.DATABASE_NAME_TEST ?? 'prestige_test')
        : (process.env.DATABASE_NAME ?? 'prestige'),
    },
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
      accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
      refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '604800', 10),
    },
    media: {
      signingSecret: process.env.MEDIA_SIGNING_SECRET ?? '',
      storageDir:
        process.env.STORAGE_DIR ?? (isTest ? './storage-test' : './storage'),
      maxPhotoMb: parseInt(process.env.MAX_PHOTO_MB ?? '25', 10),
      maxVideoMb: parseInt(process.env.MAX_VIDEO_MB ?? '300', 10),
      urlTtlSec: parseInt(process.env.MEDIA_URL_TTL_SEC ?? '3600', 10),
    },
    smtp: {
      host: process.env.SMTP_HOST ?? '127.0.0.1',
      port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
      from:
        process.env.SMTP_FROM ?? 'Prestige Gold <no-reply@prestigegold.local>',
    },
    security: {
      swaggerEnabled: bool(
        process.env.SWAGGER_ENABLED,
        nodeEnv !== 'production',
      ),
      trustProxy: bool(process.env.TRUST_PROXY, false),
      maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS ?? '5', 10),
      lockMinutes: parseInt(process.env.LOCK_MINUTES ?? '15', 10),
    },
    throttle: {
      ttlSec: parseInt(process.env.THROTTLE_TTL_SEC ?? '60', 10),
      limit: parseInt(
        process.env.THROTTLE_LIMIT ?? (isTest ? '100000' : '300'),
        10,
      ),
    },
    seed: {
      adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Prestige.2026!',
    },
  };
};
