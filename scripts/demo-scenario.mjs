/**
 * Carga un escenario demo realista contra la API en ejecución (usa los mismos
 * endpoints y reglas de negocio que la web): Escenarios A, B y C, órdenes en
 * distintos estados, evidencias, clientes con abonos y finanzas.
 *   node scripts/demo-scenario.mjs [http://localhost:3300]
 */
import sharp from 'sharp';

const BASE = (process.argv[2] ?? 'http://localhost:3300') + '/api';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Prestige.2026!';
const tokens = {};

async function token(user) {
  if (tokens[user]) return tokens[user];
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: PASSWORD }),
  });
  const b = await r.json();
  if (!r.ok) throw new Error(`login ${user}: ${JSON.stringify(b)}`);
  return (tokens[user] = b.accessToken);
}
async function call(user, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await token(user)}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text}`);
  return data;
}
const get = (u, p) => call(u, 'GET', p);
const post = (u, p, b = {}) => call(u, 'POST', p, b);
const byCode = (list, code) => list.find((x) => x.code === code);

const COLORS = [
  '#c9a24c',
  '#e3c77a',
  '#8d6b22',
  '#f0dba0',
  '#b8913a',
  '#a9822c',
];
async function photo(i, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><radialGradient id="g" cx="40%" cy="35%"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.5" stop-color="${COLORS[i % COLORS.length]}"/><stop offset="1" stop-color="#3d2e10"/></radialGradient></defs><rect width="1200" height="900" fill="#1a1712"/><circle cx="600" cy="430" r="${220 + (i % 3) * 40}" fill="url(#g)"/><circle cx="600" cy="430" r="${120 + (i % 3) * 30}" fill="#1a1712" opacity="0.85"/><text x="600" y="820" font-family="Georgia" font-size="56" fill="#e3c77a" text-anchor="middle">${label}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}
function video() {
  const ftyp = Buffer.from([
    0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0,
    0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  return Buffer.concat([
    ftyp,
    Buffer.from([0, 0, 0, 0x10, 0x6d, 0x64, 0x61, 0x74]),
    Buffer.alloc(8, 1),
  ]);
}
async function upload(user, fields, buffer, name, type) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append('file', new Blob([buffer], { type }), name);
  const r = await fetch(`${BASE}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token(user)}` },
    body: form,
  });
  if (!r.ok) throw new Error(`upload ${r.status} ${await r.text()}`);
  return r.json();
}

const weigh = async (grams, purpose, materialId) =>
  (
    await post('operaciones', '/weighings', {
      purpose,
      source: 'SCALE',
      grossGrams: grams,
      rawReading: `ST,GS,+${grams.toFixed(2).padStart(10)} g`,
      deviceInfo: 'Demo Web Serial',
      materialId,
    })
  ).id;

async function main() {
  const mats = (await get('admin', '/materials?pageSize=100')).items;
  const M = Object.fromEntries(
    [
      'AU24',
      'AU18',
      'HILO24',
      'CADIT',
      'PIEDRA',
      'SOLD',
      'AG1000',
      'LIGA10K',
    ].map((c) => [c, byCode(mats, c)]),
  );
  const W = Object.fromEntries(
    (await get('admin', '/workshops?pageSize=50')).items.map((w) => [
      w.code,
      w,
    ]),
  );
  const P = Object.fromEntries(
    (await get('admin', '/products?pageSize=50')).items.map((p) => [p.code, p]),
  );
  const stages = await get('admin', '/production-stages');

  const entry = async (code, grams, origin, extra = {}) =>
    post('operaciones', '/inventory/entries', {
      materialId: M[code].id,
      weighingId: await weigh(grams, 'ENTRY', M[code].id),
      origin,
      reference: `FAC-${Math.floor(Math.random() * 9000 + 1000)}`,
      ...extra,
    });
  const dispatch = async (orderId, workshopId, purpose, lines, decision) =>
    post('operaciones', '/dispatches', {
      orderId,
      workshopId,
      purpose,
      lines: await Promise.all(
        lines.map(async ([code, g]) => ({
          materialId: M[code].id,
          weighingId: await weigh(g, 'DISPATCH', M[code].id),
        })),
      ),
      insufficiencyDecision: decision,
    });
  const accept = async (user, d) =>
    post(user, `/dispatches/${d.id}/respond`, {
      decision: 'ACCEPT',
      signerName: `Responsable ${user}`,
      acceptCommitment: true,
      lines: d.lines.map((l) => ({ lineId: l.id, receivedGrams: l.grams })),
    });
  const stagesFor = (fam) =>
    stages.filter(
      (s) => s.families.length === 0 || s.families.some((f) => f.code === fam),
    );
  const produce = async (user, orderId, fam, upTo = 99) => {
    let i = 0;
    for (const s of stagesFor(fam)) {
      if (i++ >= upTo) break;
      await upload(
        user,
        {
          purpose: s.isFinal ? 'FINISHED' : 'STAGE',
          productionOrderId: orderId,
          stageId: s.id,
          caption: s.name,
        },
        await photo(i, s.name),
        `${s.code}.jpg`,
        'image/jpeg',
      );
      if (s.isFinal)
        await upload(
          user,
          {
            purpose: 'FINISHED',
            productionOrderId: orderId,
            stageId: s.id,
            caption: 'Pieza terminada',
          },
          await photo(i + 3, 'Pieza terminada'),
          `${s.code}-2.jpg`,
          'image/jpeg',
        );
      if (s.requiresVideo)
        await upload(
          user,
          {
            purpose: 'STAGE',
            productionOrderId: orderId,
            stageId: s.id,
            caption: `Video ${s.name}`,
          },
          video(),
          `${s.code}.mp4`,
          'video/mp4',
        );
      if (!s.isFinal)
        await post(user, `/orders/${orderId}/progress`, {
          stageId: s.id,
          completesStage: true,
          percent: Math.min(95, i * 18),
          notes: `Etapa ${s.name} completada`,
        });
    }
  };

  console.log('· Entradas de material (Balanza Madre)');
  await entry('AU24', 1000, 'Compra Fundidora Andina');
  await entry('AU24', 800, 'Compra Metales del Valle');
  await entry('HILO24', 50, 'Inventario inicial de hilo');
  await entry('AU18', 300, 'Compra Metales del Valle');
  await entry('CADIT', 250, 'Importación cadena italiana');
  await entry('PIEDRA', 40, 'Proveedor de piedras');
  await entry('SOLD', 25, 'Proveedor de soldadura');
  await entry('AG1000', 500, 'Compra plata 1000');

  console.log('· Escenario A: distribución de 1.000 g');
  for (const [code, g, user] of [
    ['TC', 200, 'taller.tc'],
    ['TJ', 200, 'taller.tj'],
    ['TJV', 200, 'taller.tjv'],
    ['TCA', 400, 'taller.tca'],
  ]) {
    const d = await dispatch(
      null,
      W[code].id,
      `Distribución de oro 24K a ${W[code].name}`,
      [['AU24', g]],
    );
    await accept(user, d);
  }

  console.log('· Escenario C: cadena Gucci con faltante de hilo');
  const today = new Date();
  const iso = (days) =>
    new Date(today.getTime() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const o1 = await post('operaciones', '/orders', {
    productId: P['GUC-CAD'].id,
    variantId: P['GUC-CAD'].variants.find((v) => v.code === '50')?.id,
    workshopId: W.TC.id,
    targetGrams: 250,
    targetUnits: 10,
    commitmentDate: iso(12),
    priority: 'HIGH',
    notes: 'Pedido Joyería El Dorado',
  });
  await post('operaciones', `/orders/${o1.id}/plan`);
  const d1 = await dispatch(
    o1.id,
    null,
    'Producción cadena Gucci 50 cm',
    [
      ['AU24', 180],
      ['HILO24', 50],
    ],
    {
      action: 'REQUEST_FABRICATION',
      justification: 'Fabricar 20 g de hilo con Javier',
      fabricationWorkshopId: W.TJV.id,
    },
  );
  await accept('taller.tc', d1);
  const o1d = await get('operaciones', `/orders/${o1.id}`);
  const childId = o1d.decisions[0].generatedOrderId;

  console.log('· Escenario B: Javier fabrica el hilo y se aprueba');
  await post('operaciones', `/orders/${childId}/plan`);
  const dc = await dispatch(childId, null, 'Fabricación de hilo 24K', [
    ['AU24', 20.2],
  ]);
  await accept('taller.tjv', dc);
  await produce('taller.tjv', childId, 'HILO');
  await post('taller.tjv', `/orders/${childId}/consumptions`, {
    items: [{ materialId: M.AU24.id, grams: 20.2 }],
  });
  await post('taller.tjv', `/orders/${childId}/finished`, {
    grams: 20,
    technicalValues: { CALIBRE: 0.8, ACABADO: 'Brillante' },
    labor: { basis: 'GRAM', quantity: 20 },
  });
  const rc = await post('operaciones', `/orders/${childId}/receipts`, {
    type: 'FINAL',
    lines: [
      {
        lineType: 'FINISHED_PRODUCT',
        weighingId: await weigh(20, 'RECEPTION'),
      },
    ],
  });
  await post('operaciones', `/orders/${childId}/receipts/${rc.id}/quality`, {
    result: 'APPROVED',
    checklist: [
      { item: 'Calibre según ficha', ok: true },
      { item: 'Sin porosidad', ok: true },
    ],
  });
  await post('operaciones', `/orders/${childId}/receipts/${rc.id}/purity`, {
    method: 'XRF',
    obtainedValue: 999.3,
    supportReference: 'XRF-2026-0001',
  });
  await post('operaciones', `/orders/${childId}/reconciliation/discrepancies`);
  await post('gerencia', `/orders/${childId}/approve`, {
    labor: { decision: 'APPROVE' },
  });

  console.log('· Cadena Gucci: producción completa y cierre');
  const d1b = await dispatch(o1.id, null, 'Complemento de hilo fabricado', [
    ['HILO24', 20],
  ]);
  await accept('taller.tc', d1b);
  await produce('taller.tc', o1.id, 'GUCCI');
  await post('taller.tc', `/orders/${o1.id}/consumptions`, {
    items: [
      { materialId: M.AU24.id, grams: 180 },
      { materialId: M.HILO24.id, grams: 70 },
    ],
  });
  await post('taller.tc', `/orders/${o1.id}/finished`, {
    grams: 246,
    units: 10,
    technicalValues: {
      CALIBRE: 6,
      ACABADO: 'Brillante',
      TIPO_CIERRE: 'Mosquetón',
    },
    lengthMm: 500,
    measures: '50 cm',
    labor: { basis: 'GRAM', quantity: 246 },
  });
  const r1 = await post('operaciones', `/orders/${o1.id}/receipts`, {
    type: 'FINAL',
    lines: [
      {
        lineType: 'FINISHED_PRODUCT',
        units: 10,
        weighingId: await weigh(245.5, 'RECEPTION'),
      },
    ],
  });
  await post('operaciones', `/orders/${o1.id}/receipts/${r1.id}/quality`, {
    result: 'APPROVED',
    checklist: [
      { item: 'Acabado y brillo', ok: true },
      { item: 'Medidas según ficha', ok: true },
      { item: 'Soldaduras', ok: true },
      { item: 'Cierre / broche', ok: true },
    ],
  });
  await post('operaciones', `/orders/${o1.id}/receipts/${r1.id}/purity`, {
    method: 'FIRE_ASSAY',
    obtainedValue: 999.1,
    supportReference: 'Ensayo al fuego #77',
  });
  await post('operaciones', `/orders/${o1.id}/reconciliation/discrepancies`);
  await post('gerencia', `/orders/${o1.id}/approve`, {
    labor: { decision: 'APPROVE', approvedValue: 2214000 },
    updateTechnicalSheet: true,
  });

  console.log(
    '· Pulseras con piedra (Jasmine): en producción con diferencia de entrega',
  );
  const o2 = await post('operaciones', '/orders', {
    productId: P['PUL-PIE'].id,
    workshopId: W.TJ.id,
    targetGrams: 100,
    targetUnits: 12,
    commitmentDate: iso(6),
    notes: 'Colección navidad',
  });
  await post('operaciones', `/orders/${o2.id}/plan`);
  const d2 = await dispatch(o2.id, null, 'Pulseras con piedra', [
    ['CADIT', 92],
    ['PIEDRA', 5],
    ['SOLD', 3],
  ]);
  const cad = d2.lines.find((l) => l.materialId === M.CADIT.id);
  await post('taller.tj', `/dispatches/${d2.id}/respond`, {
    decision: 'ACCEPT',
    signerName: 'Jasmine',
    acceptCommitment: true,
    observations: 'Faltan 0.5 g de cadena',
    lines: d2.lines.map((l) => ({
      lineId: l.id,
      receivedGrams: l.id === cad.id ? 91.5 : l.grams,
    })),
  });
  await produce('taller.tj', o2.id, 'PULSERAS', 2);
  await post('taller.tj', `/orders/${o2.id}/consumptions`, {
    items: [{ materialId: M.CADIT.id, grams: 40 }],
  });

  console.log(
    '· Anillos (Colmenares): orden retrasada y entrega pendiente de aceptar',
  );
  const o3 = await post('operaciones', '/orders', {
    productId: P['ANI-CL'].id,
    workshopId: W.TC.id,
    targetGrams: 45,
    targetUnits: 10,
    commitmentDate: iso(-3),
    notes: 'Anillos talla 7',
  });
  await post('operaciones', `/orders/${o3.id}/plan`);
  await dispatch(o3.id, null, 'Anillos clásicos 18K', [['AU18', 45.9]]);

  console.log('· Balines (Camilo): borrador y orden lista para despacho');
  await post('operaciones', '/orders', {
    productId: P['BAL-DIA'].id,
    workshopId: W.TCA.id,
    targetGrams: 120,
    commitmentDate: iso(20),
  });
  const o5 = await post('operaciones', '/orders', {
    productId: P['GUC-CAD'].id,
    workshopId: W.TCA.id,
    targetGrams: 150,
    targetUnits: 6,
    commitmentDate: iso(25),
  });
  await post('operaciones', `/orders/${o5.id}/plan`);

  console.log('· Solicitud de material y alertas');
  await post('taller.tj', '/material-requests', {
    orderId: o2.id,
    materialId: M.PIEDRA.id,
    grams: 2,
    reason: 'Piedras con defecto de fábrica',
  });

  console.log('· Clientes: venta, abonos y aporte de material');
  const customers = (await get('finanzas', '/customers?pageSize=10')).items;
  const dorado = customers.find((c) => c.name.includes('Dorado'));
  const maria = customers.find((c) => c.name.includes('María'));
  const methods = await get('finanzas', '/payment-methods');
  const op = await post('operaciones', '/customer-operations', {
    customerId: dorado.id,
    type: 'CUSTOM_ORDER',
    description: 'Cadenas Gucci 50 cm por encargo',
    totalValue: 32000000,
    committedMaterialFineGrams: 20,
    productionOrderId: o1.id,
  });
  const fg = (await get('operaciones', `/finished-goods?orderId=${o1.id}`))
    .items[0];
  await post('operaciones', '/sales', {
    operationId: op.id,
    dispatchDate: iso(0),
    lines: [{ finishedGoodId: fg.id, units: 5, value: 16000000 }],
  });
  await post('finanzas', '/customer-payments', {
    customerId: dorado.id,
    operationId: op.id,
    amount: 8000000,
    paymentMethodId: methods.find((m) => m.code === 'TRANSFERENCIA').id,
    paymentDate: iso(0),
    reference: 'TRF-88321',
  });
  await post('operaciones', '/customer-contributions', {
    customerId: dorado.id,
    operationId: op.id,
    materialId: M.AU18.id,
    weighingId: await weigh(12, 'CUSTOMER_MATERIAL', M.AU18.id),
    declaredPurity: 750,
    verifiedPurity: 748,
    timing: 'AFTER_FABRICATION',
    origin: 'Joyas usadas del cliente',
    contributionDate: iso(0),
    pricePerGram: 410000,
  });
  const op2 = await post('operaciones', '/customer-operations', {
    customerId: maria.id,
    type: 'SALE',
    description: 'Anillo de compromiso',
    totalValue: 4500000,
  });
  await post('finanzas', '/customer-payments', {
    customerId: maria.id,
    operationId: op2.id,
    amount: 1500000,
    paymentMethodId: methods.find((m) => m.code === 'EFECTIVO').id,
    paymentDate: iso(0),
  });

  console.log('· Finanzas: gastos y pago a taller');
  const cats = await get('finanzas', '/finance-categories');
  await post('finanzas', '/finance/transactions', {
    type: 'EXPENSE',
    categoryId: byCode(cats, 'ARRIENDO').id,
    concept: 'Arriendo oficina octubre',
    amount: 3500000,
    transactionDate: iso(0),
    supportReference: 'CTO-ARR-10',
    paymentMethodId: methods[1].id,
  });
  await post('finanzas', '/finance/transactions', {
    type: 'EXPENSE',
    categoryId: byCode(cats, 'SERVICIOS').id,
    concept: 'Energía y agua',
    amount: 420000,
    transactionDate: iso(0),
    supportReference: 'FAC-EPM-1022',
    paymentMethodId: methods[1].id,
  });
  await post('finanzas', '/finance/transactions', {
    type: 'EXPENSE',
    categoryId: byCode(cats, 'PAGO_TALLER').id,
    concept: 'Pago mano de obra hilo',
    amount: 70000,
    transactionDate: iso(0),
    workshopId: W.TJV.id,
    paymentMethodId: methods[0].id,
  });

  await post('operaciones', '/alerts/run-checks');
  console.log('✔ Escenario demo cargado');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
