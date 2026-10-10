import type { DataSourceOptions } from 'typeorm';
import { join } from 'node:path';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** Opciones comunes a la app Nest y a la CLI de migraciones. */
export function buildTypeOrmOptions(db: {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.name,
    entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    namingStrategy: new SnakeNamingStrategy(),
    // Esquema SOLO por migraciones (nunca synchronize en ningún ambiente).
    synchronize: false,
    migrationsRun: false,
    extra: { max: 20 },
  };
}
