import 'dotenv/config';
import { DataSource } from 'typeorm';
import configuration from '../../config/configuration';
import { buildTypeOrmOptions } from '../typeorm.options';
import { seedBase, seedDemo } from './seeder';

async function main() {
  const cfg = configuration();
  const ds = await new DataSource(buildTypeOrmOptions(cfg.database)).initialize();
  try {
    await ds.runMigrations();
    await seedBase(ds, cfg.seed.adminPassword);
    if (process.argv.includes('--demo')) await seedDemo(ds, cfg.seed.adminPassword);
    console.log(`Seed completado en ${cfg.database.name}${process.argv.includes('--demo') ? ' (con datos demo)' : ''}`);
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
