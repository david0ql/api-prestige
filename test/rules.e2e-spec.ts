import { INestApplication } from '@nestjs/common';
import { Api, byCode, createApp, pngFile } from './helpers';

/**
 * Reglas y requerimientos que no tenían una prueba dedicada: cada caso lleva en
 * su título el ID del documento ([RF-xxx], [RN-xxx], [VC-xx], [RNF-xxx]).
 */
describe('Prestige Gold · reglas de negocio y validaciones críticas (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  const M: Record<string, string> = {};
  const W: Record<string, string> = {};
  const P: Record<string, string> = {};
  let orderId = '';
  let dispatchId = '';

  beforeAll(async () => {
    app = await createApp();
    api = new Api(app);
    const mats = (await api.get('admin', '/api/materials?pageSize=100')).body.items;
    for (const c of ['AU18', 'AU24', 'CU', 'BRONCE']) M[c] = byCode(mats, c).id;
    const ws = (await api.get('admin', '/api/workshops?pageSize=50')).body.items;
    for (const c of ['TC', 'TJ']) W[c] = byCode(ws, c).id;
    const ps = (await api.get('admin', '/api/products?pageSize=50')).body.items;
    for (const c of ['ANI-CL']) P[c] = byCode(ps, c).id;
  });

  afterAll(async () => {
    await app.close();
  });

  const entry = async (material: string, grams: number, extra: object = {}) => {
    const weighingId = await api.weigh(grams, 'ENTRY', M[material]);
    return api.post('operaciones', '/api/inventory/entries', { materialId: M[material], weighingId, origin: 'Reglas e2e', ...extra });
  };

  it('[RF-004] una entrada puede asociarse a una orden de producción y a un cliente', async () => {
    const order = (await api.post('operaciones', '/api/orders', { productId: P['ANI-CL'], workshopId: W.TC, targetGrams: 10, commitmentDate: '2026-12-01' })).body;
    const customer = (await api.get('operaciones', '/api/customers')).body.items[0];
    const res = await entry('AU18', 30, { productionOrderId: order.id, customerId: customer.id });
    expect(res.status).toBe(201);
    expect(res.body.productionOrderId).toBe(order.id);
    expect(res.body.customerId).toBe(customer.id);
    orderId = order.id;
  });

  it('[RF-035] la aceptación del taller guarda firmante, IP, trazo y hash SHA-256 del contenido aceptado', async () => {
    expect((await api.post('operaciones', `/api/orders/${orderId}/plan`)).body.status).toBe('READY_FOR_DISPATCH');
    const weighingId = await api.weigh(10.2, 'DISPATCH', M.AU18);
    const d = (await api.post('operaciones', '/api/dispatches', { orderId, purpose: 'Anillos (reglas)', lines: [{ materialId: M.AU18, weighingId }] })).body;
    dispatchId = d.id;
    const res = await api.post('taller.tc', `/api/dispatches/${d.id}/respond`, {
      decision: 'ACCEPT', signerName: 'Colmenares', acceptCommitment: true,
      signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      lines: [{ lineId: d.lines[0].id, receivedGrams: 10.2 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.acceptance).toMatchObject({ decision: 'ACCEPT', signerName: 'Colmenares' });
    expect(res.body.acceptance.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.acceptance.signatureImage).toMatch(/^data:image\/png;base64,/);
    expect(res.body.acceptance.ip).toBeTruthy();
  });

  it('[RF-020] [RN-001] la recepción separa sobrante, no utilizado y devolución y los retorna pesados a Oficina Madre', async () => {
    const lines = [];
    for (const [lineType, g] of [['LEFTOVER', 1], ['UNUSED', 0.7], ['RETURN', 0.5]] as const) {
      lines.push({ lineType, materialId: M.AU18, weighingId: await api.weigh(g, 'RECEPTION', M.AU18) });
    }
    const rec = await api.post('operaciones', `/api/orders/${orderId}/receipts`, { type: 'PARTIAL', lines });
    expect(rec.status).toBe(201);
    expect(rec.body.lines.map((l: { lineType: string }) => l.lineType).sort()).toEqual(['LEFTOVER', 'RETURN', 'UNUSED']);
    const detail = (await api.get('operaciones', `/api/orders/${orderId}`)).body;
    expect(detail.custody[0].balance).toBeCloseTo(10.2 - 2.2, 4);
    const moves = (await api.get('operaciones', `/api/inventory/movements?productionOrderId=${orderId}&pageSize=50`)).body.items;
    const types = moves.map((m: { type: string }) => m.type);
    // RN-001: cada movimiento físico tiene su equivalente en el kardex.
    expect(types).toEqual(expect.arrayContaining(['DISPATCH', 'CUSTODY_ACCEPTANCE', 'RETURN']));
    expect(types.filter((t: string) => t === 'RETURN')).toHaveLength(3);
    const tooMuch = await api.post('operaciones', `/api/orders/${orderId}/receipts`, { type: 'PARTIAL', lines: [{ lineType: 'RETURN', materialId: M.AU18, weighingId: await api.weigh(50, 'RECEPTION', M.AU18) }] });
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.error).toBe('RETURN_EXCEEDS_CUSTODY');
    expect(dispatchId).toBeTruthy();
  });

  it('[VC-06] el terminado que supera lo entregado se bloquea y el que supera lo consumido exige confirmar la advertencia', async () => {
    const block = await api.post('operaciones', `/api/orders/${orderId}/receipts`, {
      type: 'PARTIAL', lines: [{ lineType: 'FINISHED_PRODUCT', units: 1, weighingId: await api.weigh(25, 'RECEPTION') }],
    });
    expect(block.status).toBe(422);
    expect(block.body.error).toBe('IMPLAUSIBLE_FINISHED');
    const warn = await api.post('operaciones', `/api/orders/${orderId}/receipts`, {
      type: 'PARTIAL', lines: [{ lineType: 'FINISHED_PRODUCT', units: 1, weighingId: await api.weigh(2, 'RECEPTION') }],
    });
    expect(warn.status).toBe(422);
    expect(warn.body.error).toBe('PLAUSIBILITY_WARNING');
  });

  it('[RN-003] no se despacha más de lo disponible salvo autorización excepcional auditada', async () => {
    await entry('BRONCE', 5);
    const lines = async () => [{ materialId: M.BRONCE, weighingId: await api.weigh(8, 'DISPATCH', M.BRONCE) }];
    const blocked = await api.post('operaciones', '/api/dispatches', { workshopId: W.TJ, purpose: 'Más de lo disponible', lines: await lines() });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error).toBe('INSUFFICIENT_STOCK');
    const noPerm = await api.post('operaciones', '/api/dispatches', { workshopId: W.TJ, purpose: 'Sin permiso', lines: await lines(), overrideReason: 'Urgencia de producción' });
    expect(noPerm.status).toBe(403);
    const weighingId = await api.weigh(8, 'DISPATCH', M.BRONCE, 'admin');
    const ok = await api.post('admin', '/api/dispatches', { workshopId: W.TJ, purpose: 'Autorizado por administración', lines: [{ materialId: M.BRONCE, weighingId }], overrideReason: 'Urgencia autorizada por gerencia' });
    expect(ok.status).toBe(201);
    expect(ok.body.lines[0].overrideApplied).toBe(true);
    const audit = (await api.get('auditor', '/api/audit?action=OVERRIDE&entityType=InventoryMovement')).body.items;
    expect(audit.some((a: { description: string }) => a.description.includes('Urgencia autorizada'))).toBe(true);
  });

  it('[RN-005] toda entrega exige taller y motivo', async () => {
    const weighingId = await api.weigh(1, 'DISPATCH', M.CU);
    expect((await api.post('operaciones', '/api/dispatches', { workshopId: W.TJ, lines: [{ materialId: M.CU, weighingId }] })).status).toBe(400);
    expect((await api.post('operaciones', '/api/dispatches', { purpose: 'Sin taller', lines: [{ materialId: M.CU, weighingId }] })).status).toBe(400);
  });

  it('[RN-006] una orden sin materiales requeridos es rechazada', async () => {
    const fams = (await api.get('admin', '/api/product-families')).body;
    const prod = (await api.post('admin', '/api/products', { code: 'SIN-STD', name: 'Producto sin estándar', familyId: byCode(fams, 'DIJES').id, workshopIds: [W.TJ] })).body;
    const res = await api.post('operaciones', '/api/orders', { productId: prod.id, workshopId: W.TJ, targetGrams: 5, commitmentDate: '2026-12-01' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('ORDER_WITHOUT_MATERIALS');
    const withExtra = await api.post('operaciones', '/api/orders', { productId: prod.id, workshopId: W.TJ, targetGrams: 5, commitmentDate: '2026-12-01', extraRequirements: [{ materialId: M.AU18, requiredGrams: 5.1 }] });
    expect(withExtra.status).toBe(201);
  });

  it('[VC-02] un material inactivo no es válido para operar', async () => {
    const cats = (await api.get('admin', '/api/material-categories')).body;
    const units = (await api.get('admin', '/api/units')).body;
    const mat = (await api.post('admin', '/api/materials', { code: 'INACT', name: 'Material inactivo', categoryId: byCode(cats, 'METAL_BASE').id, baseUnitId: byCode(units, 'g').id })).body;
    await api.patch('admin', `/api/materials/${mat.id}`, { status: 'INACTIVE' });
    const weighingId = await api.weigh(2, 'ENTRY');
    const res = await api.post('operaciones', '/api/inventory/entries', { materialId: mat.id, weighingId, origin: 'No debe entrar' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/inactivo/);
  });

  it('[VC-03] solo talleres habilitados pueden recibir una orden del producto', async () => {
    const res = await api.post('operaciones', '/api/orders', { productId: P['ANI-CL'], workshopId: W.TJ, targetGrams: 5, commitmentDate: '2026-12-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no está habilitado/);
  });

  it('[RN-002] el gramo es la base y la balanza acepta unidades auxiliares convertidas a gramo', async () => {
    const res = await api.post('operaciones', '/api/weighings', { purpose: 'ENTRY', source: 'SCALE', grossGrams: 1500, rawReading: 'ST,GS,+   1.500 kg' });
    expect(res.status).toBe(201);
    expect(res.body.netGrams).toBe(1500);
    const units = (await api.get('operaciones', '/api/units')).body;
    expect(byCode(units, 'g').isBase).toBe(true);
    expect(byCode(units, 'ozt').factorToGram).toBeCloseTo(31.1034768, 5);
  });

  it('[RF-032] el reporte de cumplimiento compara fecha comprometida contra fecha real', async () => {
    const late = (await api.post('operaciones', '/api/orders', { productId: P['ANI-CL'], workshopId: W.TC, targetGrams: 5, commitmentDate: '2026-02-10' })).body;
    const rep = (await api.get('gerencia', '/api/reports/compliance?from=2026-02-01&to=2026-02-28')).body;
    const row = rep.rows.find((r: { number: string }) => r.number === late.number);
    expect(row).toMatchObject({ result: 'Vencida sin entregar', commitmentDate: '2026-02-10' });
    expect(row.deviationDays).toBeGreaterThan(0);
  });

  it('[RNF-011] [RNF-009] las fotos se optimizan en versión web y miniatura y se sirven firmadas', async () => {
    const up = await api.upload('taller.tc', { purpose: 'PROGRESS', productionOrderId: orderId }, await pngFile());
    expect(up.status).toBe(201);
    expect(up.body.kind).toBe('PHOTO');
    expect(up.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    const thumb = await api.http.get(up.body.urls.thumb);
    expect(thumb.status).toBe(200);
    expect(thumb.headers['content-type']).toBe('image/webp');
    const web = await api.http.get(up.body.urls.web);
    expect(web.headers['content-type']).toBe('image/webp');
  });

  it('[RNF-006] [RNF-007] disponibilidad y tiempos de respuesta de consultas operativas', async () => {
    const health = await api.http.get('/api/health');
    expect(health.body.info.database.status).toBe('up');
    for (const url of ['/api/inventory/summary', '/api/orders?pageSize=50', '/api/dashboard/office', '/api/inventory/movements?pageSize=50']) {
      const t0 = Date.now();
      const res = await api.get('gerencia', url);
      expect(res.status).toBe(200);
      expect(Date.now() - t0).toBeLessThan(2000);
    }
  });
});
