import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import configuration from '../src/config/configuration';
import { buildTypeOrmOptions } from '../src/database/typeorm.options';
import { createApp } from './helpers';

/**
 * Carga inicial por API (POST /api/setup/seed) sobre una base NUEVA y vacía:
 * exige el token de instalación, solo corre si no hay datos y nunca sobrescribe.
 * La base temporal se crea y elimina con la API de TypeORM (sin SQL crudo).
 */
const TEMP_DB = 'prestige_setup_test';
const TOKEN = 'token-de-instalacion-de-prueba-0123456789';

describe('Prestige Gold · carga inicial por API (e2e)', () => {
  let app: INestApplication;
  const prev = {
    db: process.env.DATABASE_NAME_TEST,
    token: process.env.SETUP_TOKEN,
    pwd: process.env.SEED_ADMIN_PASSWORD,
  };
  let admin: DataSource;

  beforeAll(async () => {
    admin = await new DataSource(
      buildTypeOrmOptions(configuration().database),
    ).initialize();
    const qr = admin.createQueryRunner();
    await qr.dropDatabase(TEMP_DB, true);
    await qr.createDatabase(TEMP_DB, true);
    await qr.release();
    process.env.DATABASE_NAME_TEST = TEMP_DB;
    const fresh = await new DataSource(
      buildTypeOrmOptions(configuration().database),
    ).initialize();
    await fresh.runMigrations();
    await fresh.destroy();
    process.env.SEED_ADMIN_PASSWORD = 'Instalacion.Segura.2026';
    process.env.SETUP_TOKEN = TOKEN;
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
    process.env.DATABASE_NAME_TEST = prev.db;
    process.env.SETUP_TOKEN = prev.token;
    process.env.SEED_ADMIN_PASSWORD = prev.pwd;
    const qr = admin.createQueryRunner();
    await qr.dropDatabase(TEMP_DB, true);
    await qr.release();
    await admin.destroy();
  });

  const http = () => request(app.getHttpServer());

  it('[SETUP] la base nueva figura como no inicializada y sin usuarios no se puede ingresar', async () => {
    expect((await http().get('/api/setup/status')).body).toEqual({
      initialized: false,
      seedEnabled: true,
    });
    expect(
      (
        await http()
          .post('/api/auth/login')
          .send({ username: 'admin', password: 'Instalacion.Segura.2026' })
      ).status,
    ).toBe(401);
  });

  it('[SETUP] sin token o con token incorrecto no carga nada', async () => {
    expect((await http().post('/api/setup/seed').send({})).status).toBe(401);
    expect(
      (
        await http()
          .post('/api/setup/seed')
          .set('X-Setup-Token', 'otro')
          .send({})
      ).status,
    ).toBe(401);
    expect((await http().get('/api/setup/status')).body.initialized).toBe(
      false,
    );
  });

  it('[SETUP] con el token carga roles, maestros y administrador una sola vez', async () => {
    const res = await http()
      .post('/api/setup/seed')
      .set('X-Setup-Token', TOKEN)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      seeded: true,
      demo: false,
      admin: { username: 'admin' },
    });
    expect((await http().get('/api/setup/status')).body.initialized).toBe(true);

    const login = await http()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Instalacion.Segura.2026' });
    expect(login.status).toBe(200);
    const auth = `Bearer ${login.body.accessToken}`;
    const roles = (await http().get('/api/roles').set('Authorization', auth))
      .body as { code: string }[];
    expect(roles.map((r) => r.code)).toEqual(
      expect.arrayContaining([
        'ADMIN',
        'OPERATIONS',
        'FINANCE',
        'APPROVER',
        'AUDITOR',
        'WORKSHOP',
      ]),
    );
    const params = (
      await http().get('/api/parameters').set('Authorization', auth)
    ).body as { key: string }[];
    expect(params.map((p) => p.key)).toContain('scale.config');
    // Sin datos de demostración: no hay órdenes.
    expect(
      (await http().get('/api/orders').set('Authorization', auth)).body.total,
    ).toBe(0);

    // Segunda ejecución: la base ya tiene datos → 409 y nada cambia.
    const again = await http()
      .post('/api/setup/seed')
      .set('X-Setup-Token', TOKEN)
      .send({ demo: true });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('ALREADY_INITIALIZED');
    expect(
      (await http().get('/api/orders').set('Authorization', auth)).body.total,
    ).toBe(0);
  });
});
