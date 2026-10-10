import { INestApplication } from '@nestjs/common';
import { Api, byCode, createApp, PASSWORD } from './helpers';

const cookieOf = (res: { headers: Record<string, unknown> }) => {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((c) => c.startsWith('pg_rt=')) ?? '';
};

/** Seguridad (RNF-004, RF-036, sección 11) y administración sin código (RF-037/038, CA-012). */
describe('Prestige Gold · seguridad, autenticación y administración (e2e)', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    app = await createApp();
    api = new Api(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Autenticación (P01)', () => {
    it('inicia sesión, devuelve permisos y deja el refresh token solo en cookie httpOnly/strict', async () => {
      const res = await api.http.post('/api/auth/login').send({ username: 'ADMIN', password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.user.permissions).toContain('users.manage');
      const cookie = cookieOf(res);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      const me = await api.http.get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(me.body.roleCode).toBe('ADMIN');
    });

    it('responde igual para usuario inexistente y contraseña incorrecta', async () => {
      const a = await api.http.post('/api/auth/login').send({ username: 'nadie', password: 'x' });
      const b = await api.http.post('/api/auth/login').send({ username: 'admin', password: 'incorrecta' });
      expect(a.status).toBe(401);
      expect(b.status).toBe(401);
      expect(a.body.message).toBe(b.body.message);
    });

    it('bloquea la cuenta tras 5 intentos fallidos y el administrador puede desbloquearla', async () => {
      const roles = (await api.get('admin', '/api/roles')).body;
      const created = await api.post('admin', '/api/users', { username: 'bloqueo.e2e', email: 'bloqueo@e2e.local', fullName: 'Usuario Bloqueo', password: 'Segura.12345', roleId: byCode(roles, 'AUDITOR').id, mustChangePassword: false });
      expect(created.status).toBe(201);
      expect(created.body.passwordHash).toBeUndefined();
      for (let i = 0; i < 5; i++) expect((await api.http.post('/api/auth/login').send({ username: 'bloqueo.e2e', password: 'mala' })).status).toBe(401);
      const locked = await api.http.post('/api/auth/login').send({ username: 'bloqueo.e2e', password: 'Segura.12345' });
      expect(locked.status).toBe(403);
      expect(locked.body.message).toMatch(/bloqueada/);
      expect((await api.post('admin', `/api/users/${created.body.id}/unlock`)).status).toBe(204);
      expect((await api.http.post('/api/auth/login').send({ username: 'bloqueo.e2e', password: 'Segura.12345' })).status).toBe(200);
      const failures = (await api.get('auditor', `/api/audit?action=LOGIN_FAILED&entityId=${created.body.id}`)).body;
      expect(failures.total).toBeGreaterThanOrEqual(5);
    });

    it('rota el refresh token, detecta reuso y revoca la sesión', async () => {
      const login = await api.http.post('/api/auth/login').send({ username: 'finanzas', password: PASSWORD });
      const c1 = cookieOf(login).split(';')[0];
      const noHeader = await api.http.post('/api/auth/refresh').set('Cookie', c1);
      expect(noHeader.status).toBe(401);
      const r1 = await api.http.post('/api/auth/refresh').set('Cookie', c1).set('X-Requested-With', 'XMLHttpRequest');
      expect(r1.status).toBe(200);
      const c2 = cookieOf(r1).split(';')[0];
      expect(c2).not.toBe(c1);
      // Reuso del token anterior = posible robo → se revoca toda la familia.
      const reuse = await api.http.post('/api/auth/refresh').set('Cookie', c1).set('X-Requested-With', 'XMLHttpRequest');
      expect(reuse.status).toBe(401);
      const after = await api.http.post('/api/auth/refresh').set('Cookie', c2).set('X-Requested-With', 'XMLHttpRequest');
      expect(after.status).toBe(401);
      const me = await api.http.get('/api/auth/me').set('Authorization', `Bearer ${r1.body.accessToken}`);
      expect(me.status).toBe(401);
    });

    it('logout invalida el access token inmediatamente', async () => {
      const login = await api.http.post('/api/auth/login').send({ username: 'auditor', password: PASSWORD });
      const token = login.body.accessToken;
      expect((await api.http.post('/api/auth/logout').set('Authorization', `Bearer ${token}`)).status).toBe(204);
      expect((await api.http.get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
    });

    it('recuperación de acceso por correo (Mailpit) con token de un solo uso', async () => {
      const unknown = await api.http.post('/api/auth/forgot-password').send({ email: 'noexiste@x.com' });
      expect(unknown.status).toBe(202);
      const roles = (await api.get('admin', '/api/roles')).body;
      const email = `reset.${Date.now()}@e2e.local`;
      await api.post('admin', '/api/users', { username: `reset.${Date.now()}`, email, fullName: 'Reset E2E', password: 'Inicial.12345', roleId: byCode(roles, 'AUDITOR').id, mustChangePassword: false });
      const known = await api.http.post('/api/auth/forgot-password').send({ email });
      expect(known.status).toBe(202);
      expect(known.body.message).toBe(unknown.body.message);
      let token = '';
      for (let i = 0; i < 20 && !token; i++) {
        const list = await fetch(`http://127.0.0.1:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then((r) => r.json()) as { messages: { ID: string }[] };
        if (list.messages?.length) {
          const msg = await fetch(`http://127.0.0.1:8025/api/v1/message/${list.messages[0].ID}`).then((r) => r.json()) as { Text: string };
          token = decodeURIComponent(/token=([^\s"<]+)/.exec(msg.Text)?.[1] ?? '');
        } else await new Promise((r) => setTimeout(r, 250));
      }
      expect(token.length).toBeGreaterThan(20);
      const weak = await api.http.post('/api/auth/reset-password').send({ token, newPassword: 'debil' });
      expect(weak.status).toBe(400);
      expect((await api.http.post('/api/auth/reset-password').send({ token, newPassword: 'NuevaClave.2026' })).status).toBe(204);
      expect((await api.http.post('/api/auth/reset-password').send({ token, newPassword: 'OtraClave.2026' })).status).toBe(400);
      expect((await api.http.post('/api/auth/login').send({ username: email, password: 'NuevaClave.2026' })).status).toBe(200);
    });

    it('rechaza tokens inválidos, manipulados o sin firma', async () => {
      expect((await api.http.get('/api/materials')).status).toBe(401);
      expect((await api.http.get('/api/materials').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'x', sid: 'y', typ: 'access' })).toString('base64url');
      expect((await api.http.get('/api/materials').set('Authorization', `Bearer ${header}.${payload}.`)).status).toBe(401);
    });

    it('cambio de contraseña exige la actual y aplica la política', async () => {
      const weak = await api.post('auditor', '/api/auth/change-password', { currentPassword: PASSWORD, newPassword: '1234' });
      expect(weak.status).toBe(400);
      const wrong = await api.post('auditor', '/api/auth/change-password', { currentPassword: 'mala', newPassword: 'Valida.123456' });
      expect(wrong.status).toBe(400);
    });
  });

  describe('Endurecimiento HTTP y validación', () => {
    it('envía cabeceras de seguridad y oculta la tecnología', async () => {
      const res = await api.http.get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['content-security-policy']).toBeTruthy();
      expect(res.headers['referrer-policy']).toBe('no-referrer');
    });

    it('CORS solo para orígenes permitidos', async () => {
      const bad = await api.http.options('/api/materials').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
      expect(bad.headers['access-control-allow-origin']).toBeUndefined();
      const good = await api.http.options('/api/materials').set('Origin', 'http://localhost:5180').set('Access-Control-Request-Method', 'GET');
      expect(good.headers['access-control-allow-origin']).toBe('http://localhost:5180');
    });

    it('rechaza campos no permitidos, ids mal formados y valores inválidos', async () => {
      const extra = await api.post('operaciones', '/api/weighings', { purpose: 'ENTRY', source: 'MANUAL', grossGrams: 5, manualReason: 'prueba extra', isAdmin: true });
      expect(extra.status).toBe(400);
      expect((await api.get('operaciones', '/api/orders/no-es-uuid')).status).toBe(400);
      const zero = await api.post('operaciones', '/api/weighings', { purpose: 'ENTRY', source: 'MANUAL', grossGrams: 0, manualReason: 'peso cero' });
      expect(zero.status).toBe(400);
      const negative = await api.post('operaciones', '/api/weighings', { purpose: 'ENTRY', source: 'MANUAL', grossGrams: 5, tareGrams: 10, manualReason: 'neto negativo' });
      expect(negative.status).toBe(422);
    });

    it('las búsquedas son parametrizadas por el ORM (sin inyección SQL)', async () => {
      const res = await api.get('admin', `/api/materials?search=${encodeURIComponent("' OR 1=1; DROP TABLE material; --")}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect((await api.get('admin', '/api/materials')).body.total).toBeGreaterThan(0);
    });

    it('ningún endpoint devuelve el hash de contraseña', async () => {
      const users = await api.get('admin', '/api/users?pageSize=100');
      expect(JSON.stringify(users.body)).not.toMatch(/passwordHash|argon2/);
    });
  });

  describe('Roles, permisos y segregación de funciones (sección 11)', () => {
    it('cada rol solo accede a lo autorizado', async () => {
      expect((await api.get('auditor', '/api/audit')).status).toBe(200);
      expect((await api.post('auditor', '/api/materials', { code: 'X', name: 'X' })).status).toBe(403);
      expect((await api.get('finanzas', '/api/finance/summary')).status).toBe(200);
      expect((await api.post('finanzas', '/api/orders', {})).status).toBe(403);
      expect((await api.get('operaciones', '/api/users')).status).toBe(403);
      expect((await api.get('operaciones', '/api/finance/summary')).status).toBe(403);
      expect((await api.get('gerencia', '/api/reports/profitability')).status).toBe(200);
      expect((await api.post('taller.tc', '/api/inventory/entries', {})).status).toBe(403);
    });

    it('un rol de taller no puede recibir permisos de aprobación ni finanzas (RN-009)', async () => {
      const res = await api.post('admin', '/api/roles', { code: 'TALLER_PLUS', name: 'Taller con aprobación', permissions: ['workshop.portal', 'orders.approve'], isWorkshopRole: true });
      expect(res.status).toBe(400);
      const ok = await api.post('admin', '/api/roles', { code: 'SUPERVISOR', name: 'Supervisor de inventario', permissions: ['inventory.read', 'reports.read'] });
      expect(ok.status).toBe(201);
      const catalog = await api.get('admin', '/api/roles/permissions');
      expect(catalog.body.length).toBeGreaterThan(40);
    });

    it('un usuario de taller debe tener taller y uno de oficina no', async () => {
      const roles = (await api.get('admin', '/api/roles')).body;
      const noWs = await api.post('admin', '/api/users', { username: 'sin.taller', email: 'sin.taller@e2e.local', fullName: 'Sin taller', password: 'Segura.12345', roleId: byCode(roles, 'WORKSHOP').id });
      expect(noWs.status).toBe(400);
    });

    it('desactivar un usuario revoca sus sesiones', async () => {
      const roles = (await api.get('admin', '/api/roles')).body;
      const u = (await api.post('admin', '/api/users', { username: 'temporal.e2e', email: 'temporal@e2e.local', fullName: 'Temporal', password: 'Segura.12345', roleId: byCode(roles, 'AUDITOR').id, mustChangePassword: false })).body;
      const login = await api.http.post('/api/auth/login').send({ username: 'temporal.e2e', password: 'Segura.12345' });
      expect((await api.patch('admin', `/api/users/${u.id}`, { active: false })).status).toBe(200);
      expect((await api.http.get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`)).status).toBe(401);
      expect((await api.http.post('/api/auth/login').send({ username: 'temporal.e2e', password: 'Segura.12345' })).status).toBe(403);
    });
  });

  describe('Administración sin desarrollo (RF-037/038, RN-018, CA-012)', () => {
    it('CA-012 · crea un taller nuevo con su custodia, productos y usuario, operativo de inmediato', async () => {
      const products = (await api.get('admin', '/api/products?pageSize=50')).body.items;
      const badProduct = await api.post('admin', '/api/workshops', { code: 'tal', name: 'Alex', productIds: ['00000000-0000-4000-8000-000000000000'] });
      expect(badProduct.status).toBe(400);
      const created = await api.post('admin', '/api/workshops', { code: 'tal', name: 'Alex', responsible: 'Alex', email: 'alex@e2e.local', productIds: [byCode(products, 'GUC-CAD').id] });
      expect(created.status).toBe(201);
      expect(created.body.code).toBe('TAL');
      expect(created.body.products[0].product.code).toBe('GUC-CAD');
      const locations = (await api.get('admin', '/api/locations')).body;
      expect(locations.some((l: { code: string; type: string }) => l.code === 'TALLER-TAL' && l.type === 'WORKSHOP')).toBe(true);
      const roles = (await api.get('admin', '/api/roles')).body;
      const user = await api.post('admin', '/api/users', { username: 'taller.tal', email: 'tal@e2e.local', fullName: 'Usuario Taller Alex', password: 'Segura.12345', roleId: byCode(roles, 'WORKSHOP').id, workshopId: created.body.id, mustChangePassword: false });
      expect(user.status).toBe(201);
      const login = await api.http.post('/api/auth/login').send({ username: 'taller.tal', password: 'Segura.12345' });
      const dash = await api.http.get('/api/workshop-portal/dashboard').set('Authorization', `Bearer ${login.body.accessToken}`);
      expect(dash.status).toBe(200);
      expect(dash.body.workshop.code).toBe('TAL');
      const duplicated = await api.post('admin', '/api/workshops', { code: 'TAL', name: 'Otro' });
      expect(duplicated.status).toBe(409);
    });

    it('RF-038 · crea materiales, productos, variantes, estándares, etapas y variables sin código', async () => {
      const cats = (await api.get('admin', '/api/material-categories')).body;
      const units = (await api.get('admin', '/api/units')).body;
      const mat = await api.post('admin', '/api/materials', { code: 'AU14', name: 'Oro 14K', categoryId: byCode(cats, 'METAL').id, baseUnitId: byCode(units, 'g').id, purity: 585, karat: 14, purityTolerance: 5, referenceCost: 250000, minStock: 10 });
      expect(mat.status).toBe(201);
      const fams = (await api.get('admin', '/api/product-families')).body;
      const ws = (await api.get('admin', '/api/workshops')).body.items;
      const prod = await api.post('admin', '/api/products', { code: 'DIJ-COR', name: 'Dije corazón 14K', familyId: byCode(fams, 'DIJES').id, targetPurity: 585, purityTolerance: 5, workshopIds: [byCode(ws, 'TJ').id] });
      expect(prod.status).toBe(201);
      expect((await api.post('admin', `/api/products/${prod.body.id}/variants`, { code: 'M', name: 'Mediano', standardWeight: 2 })).status).toBe(201);
      const std = await api.post('admin', `/api/products/${prod.body.id}/standards`, { materialId: mat.body.id, basis: 'PER_UNIT', quantity: 2.1, tolerancePct: 5 });
      expect(std.status).toBe(201);
      expect((await api.post('admin', `/api/products/${prod.body.id}/standards`, { materialId: mat.body.id, basis: 'PER_UNIT', quantity: 2 })).status).toBe(409);
      const stage = await api.post('admin', '/api/production-stages', { code: 'ENGASTE', name: 'Engaste', sequence: 7, requiresPhoto: true, familyIds: [byCode(fams, 'DIJES').id] });
      expect(stage.status).toBe(201);
      const variable = await api.post('admin', '/api/technical-variables', { code: 'COLOR_PIEDRA', name: 'Color de piedra', dataType: 'SELECT', options: ['Blanca', 'Roja'] });
      expect(variable.status).toBe(201);
      // La orden calcula insumos por unidad: 10 u × 2.1 g = 21 g.
      const order = await api.post('operaciones', '/api/orders', { productId: prod.body.id, workshopId: byCode(ws, 'TJ').id, targetGrams: 20, targetUnits: 10, commitmentDate: '2026-12-01' });
      expect(order.status).toBe(201);
      expect(order.body.requirements[0].requiredGrams).toBe(21);
    });

    it('parámetros del sistema editables (P18)', async () => {
      const params = (await api.get('admin', '/api/parameters')).body;
      expect(params.find((p: { key: string }) => p.key === 'production.defaultLossTolerancePct')).toBeTruthy();
      const upd = await api.put('admin', '/api/parameters/alerts.pendingAcceptanceHours', { value: 12 });
      expect(upd.status).toBe(200);
      expect(upd.body.value).toBe(12);
      expect((await api.put('operaciones', '/api/parameters/alerts.pendingAcceptanceHours', { value: 1 })).status).toBe(403);
    });

    it('CA-015 · ficha técnica versionada con variables validadas', async () => {
      const products = (await api.get('operaciones', '/api/catalog/products')).body;
      const ani = byCode(products, 'ANI-CL');
      const bad = await api.post('operaciones', `/api/catalog/products/${ani.id}/sheets`, { changeReason: 'Variable inexistente', variables: { NO_EXISTE: 1 } });
      expect(bad.status).toBe(400);
      const v2 = await api.post('operaciones', `/api/catalog/products/${ani.id}/sheets`, { standardWeight: 4.8, diameterMm: 18.2, measures: 'Talla 7.5', variables: { CALIBRE: 2, ACABADO: 'Mate', TALLA: '7.5' }, changeReason: 'Ajuste de peso estándar' });
      expect(v2.status).toBe(201);
      expect(v2.body.versionNumber).toBe(2);
      const detail = (await api.get('operaciones', `/api/catalog/products/${ani.id}`)).body;
      expect(detail.versions.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([2, 1]);
      expect(detail.versions[1].standardWeight).toBe(4.5);
      expect(detail.product.standardWeight).toBe(4.8);
    });
  });

  it('limita la tasa de peticiones en endpoints sensibles', async () => {
    let limited = false;
    for (let i = 0; i < 40 && !limited; i++) {
      const r = await api.http.post('/api/auth/refresh');
      if (r.status === 429) limited = true;
    }
    expect(limited).toBe(true);
  });
});
