import 'dotenv/config';
import { DataSource } from 'typeorm';
import configuration from '../../config/configuration';
import { buildTypeOrmOptions } from '../typeorm.options';
import { User } from '../../modules/users/entities/user.entity';
import { seedBase, seedDemo, syncSystemRoles } from './seeder';

async function main() {
  const cfg = configuration();
  const ds = await new DataSource(
    buildTypeOrmOptions(cfg.database),
  ).initialize();
  try {
    await ds.runMigrations();
    // --init (arranque del contenedor): migraciones + roles del sistema. Los datos iniciales se crean con
    // POST /api/setup/seed (solo sobre base vacía), o aquí mismo si AUTO_SEED=true.
    if (process.argv.includes('--init')) {
      await syncSystemRoles(ds);
      const empty = (await ds.manager.count(User)) === 0;
      if (!empty || process.env.AUTO_SEED !== 'true') {
        console.log(
          empty
            ? 'Base vacía: ejecute la carga inicial con POST /api/setup/seed (cabecera X-Setup-Token)'
            : 'Base existente: migraciones aplicadas y roles del sistema sincronizados',
        );
        return;
      }
    }
    if (
      process.env.NODE_ENV === 'production' &&
      (!process.env.SEED_ADMIN_PASSWORD ||
        cfg.seed.adminPassword === 'Prestige.2026!')
    )
      throw new Error(
        'Defina SEED_ADMIN_PASSWORD (contraseña inicial del administrador) para producción',
      );
    await seedBase(ds, cfg.seed.adminPassword, process.env.SEED_ADMIN_EMAIL);
    if (process.argv.includes('--demo'))
      await seedDemo(ds, cfg.seed.adminPassword);
    console.log(
      `Seed completado en ${cfg.database.name}${process.argv.includes('--demo') ? ' (con datos demo)' : ''}`,
    );
  } finally {
    await ds.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
