import 'dotenv/config';
import { rm } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import configuration from '../../config/configuration';
import { buildTypeOrmOptions } from '../typeorm.options';
import { seedBase, seedDemo } from './seeder';

/**
 * Reconstruye una base desde cero (drop → migraciones → seed). Pensado para los
 * ambientes de prueba; se niega a tocar la base principal sin --force.
 */
async function main() {
  const cfg = configuration();
  if (cfg.database.name === 'prestige' && !process.argv.includes('--force')) {
    throw new Error(
      'Por seguridad no se reinicia la base principal sin --force',
    );
  }
  const ds = await new DataSource(
    buildTypeOrmOptions(cfg.database),
  ).initialize();
  await ds.dropDatabase();
  await ds.runMigrations();
  await seedBase(ds, cfg.seed.adminPassword);
  if (!process.argv.includes('--no-demo'))
    await seedDemo(ds, cfg.seed.adminPassword);
  await ds.destroy();
  if (process.env.STORAGE_DIR)
    await rm(process.env.STORAGE_DIR, { recursive: true, force: true });
  console.log(`Base ${cfg.database.name} reconstruida`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
