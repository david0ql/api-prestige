import 'dotenv/config';
import { rm } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { buildTypeOrmOptions } from '../src/database/typeorm.options';
import { seedBase, seedDemo } from '../src/database/seeds/seeder';

/** Reconstruye la BD de pruebas desde cero con migraciones + seed (todo vía ORM). */
export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  const cfg = configuration();
  if (cfg.database.name !== (process.env.DATABASE_NAME_TEST ?? 'prestige_test')) {
    throw new Error('Las pruebas solo pueden ejecutarse contra la base de pruebas');
  }
  const ds = await new DataSource(buildTypeOrmOptions(cfg.database)).initialize();
  await ds.dropDatabase();
  await ds.runMigrations();
  await seedBase(ds, cfg.seed.adminPassword);
  await seedDemo(ds, cfg.seed.adminPassword);
  await ds.destroy();
  await rm('./storage-test', { recursive: true, force: true });
}
