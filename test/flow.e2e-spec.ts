import { INestApplication } from '@nestjs/common';
import { Api, byCode, createApp, mp4File, pngFile } from './helpers';

/**
 * Flujo punta a punta de la especificación v1.1: escenarios A, B y C y los
 * criterios de aceptación CA-001…CA-016 ejercitados contra la API real y una
 * base PostgreSQL de pruebas.
 */
describe('Prestige Gold · flujo completo (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  const M: Record<string, { id: string; code: string; name: string }> = {};
  const W: Record<string, { id: string; code: string }> = {};
  const P: Record<string, { id: string; code: string }> = {};
  let stages: {
    id: string;
    code: string;
    families: { code: string }[];
    isFinal: boolean;
  }[] = [];

  beforeAll(async () => {
    app = await createApp();
    api = new Api(app);
    const mats = (await api.get('admin', '/api/materials?pageSize=100')).body
      .items;
    for (const c of ['AU24', 'AU18', 'HILO24', 'CADIT', 'PIEDRA', 'SOLD'])
      M[c] = byCode(mats, c);
    const ws = (await api.get('admin', '/api/workshops?pageSize=50')).body
      .items;
    for (const c of ['TC', 'TJ', 'TJV', 'TCA']) W[c] = byCode(ws, c);
    const ps = (await api.get('admin', '/api/products?pageSize=50')).body.items;
    for (const c of ['GUC-CAD', 'HILO-24', 'PUL-PIE', 'ANI-CL'])
      P[c] = byCode(ps, c);
    stages = (await api.get('admin', '/api/production-stages')).body;
  });

  afterAll(async () => {
    await app.close();
  });

  const entry = async (material: string, grams: number, extra: object = {}) => {
    const weighingId = await api.weigh(grams, 'ENTRY', M[material].id);
    const res = await api.post('operaciones', '/api/inventory/entries', {
      materialId: M[material].id,
      weighingId,
      origin: 'Compra proveedor (e2e)',
      reference: 'FAC-E2E',
      ...extra,
    });
    expect(res.status).toBe(201);
    return res.body;
  };

  const officeGrams = async (material: string) => {
    const summary = (await api.get('operaciones', '/api/inventory/summary'))
      .body as {
      material: { code: string };
      office: number;
      total: number;
      workshops: number;
      byWorkshop: { code: string; grams: number }[];
    }[];
    return summary.find((s) => s.material.code === material);
  };

  const dispatch = async (body: object, expected = 201) => {
    const res = await api.post('operaciones', '/api/dispatches', body);
    expect(res.status).toBe(expected);
    return res;
  };

  const accept = async (
    workshopUser: string,
    dispatchBody: { id: string; lines: { id: string; grams: number }[] },
    received?: Record<string, number>,
  ) => {
    const res = await api.post(
      workshopUser,
      `/api/dispatches/${dispatchBody.id}/respond`,
      {
        decision: 'ACCEPT',
        signerName: `Firma ${workshopUser}`,
        signatureImage:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        acceptCommitment: true,
        lines: dispatchBody.lines.map((l) => ({
          lineId: l.id,
          receivedGrams: received?.[l.id] ?? l.grams,
        })),
      },
    );
    expect(res.status).toBe(201);
    return res.body;
  };

  /** Sube la evidencia exigida y completa cada etapa no final del producto. */
  const completeStages = async (
    workshopUser: string,
    orderId: string,
    familyCode: string,
  ) => {
    const png = await pngFile();
    const applicable = stages.filter(
      (s) =>
        s.families.length === 0 ||
        s.families.some((f) => f.code === familyCode),
    );
    for (const s of applicable) {
      const up = await api.upload(
        workshopUser,
        {
          purpose: s.isFinal ? 'FINISHED' : 'STAGE',
          productionOrderId: orderId,
          stageId: s.id,
          caption: s.code,
        },
        png,
      );
      expect(up.status).toBe(201);
      if (s.isFinal) {
        expect(
          (
            await api.upload(
              workshopUser,
              {
                purpose: 'FINISHED',
                productionOrderId: orderId,
                stageId: s.id,
              },
              png,
            )
          ).status,
        ).toBe(201);
      }
      if (['PULIDO', 'TERMINADO'].includes(s.code)) {
        const v = await api.upload(
          workshopUser,
          { purpose: 'STAGE', productionOrderId: orderId, stageId: s.id },
          mp4File(),
        );
        expect(v.status).toBe(201);
        expect(v.body.kind).toBe('VIDEO');
      }
      if (!s.isFinal) {
        const pr = await api.post(
          workshopUser,
          `/api/orders/${orderId}/progress`,
          {
            stageId: s.id,
            completesStage: true,
            percent: 50,
            notes: `Etapa ${s.code}`,
          },
        );
        expect(pr.status).toBe(201);
      }
    }
  };

  // ---------------------------------------------------------------- CA-001
  it('CA-001 · registra material en Balanza Madre y lo refleja en inventario', async () => {
    const before = (await officeGrams('AU24'))?.office ?? 0;
    const mv = await entry('AU24', 1000);
    expect(mv.type).toBe('ENTRY');
    expect(mv.grams).toBe(1000);
    expect((await officeGrams('AU24'))!.office).toBeCloseTo(before + 1000, 4);
  });

  it('RN-019 · la captura desde balanza no permite alterar el peso leído', async () => {
    const ok = await api.post('operaciones', '/api/weighings', {
      purpose: 'ENTRY',
      source: 'SCALE',
      grossGrams: 125.5,
      rawReading: 'ST,GS,+  125.50 g',
      deviceInfo: 'Web Serial',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.source).toBe('SCALE');
    const tampered = await api.post('operaciones', '/api/weighings', {
      purpose: 'ENTRY',
      source: 'SCALE',
      grossGrams: 130,
      rawReading: 'ST,GS,+  125.50 g',
    });
    expect(tampered.status).toBe(422);
    expect(tampered.body.error).toBe('SCALE_READING_MISMATCH');
    const unstable = await api.post('operaciones', '/api/weighings', {
      purpose: 'ENTRY',
      source: 'SCALE',
      grossGrams: 125.5,
      rawReading: 'US,GS,+  125.50 g',
    });
    expect(unstable.status).toBe(422);
    // RF-003: captura manual exige motivo y rol autorizado.
    const noReason = await api.post('operaciones', '/api/weighings', {
      purpose: 'ENTRY',
      source: 'MANUAL',
      grossGrams: 10,
    });
    expect(noReason.status).toBe(400);
    const finance = await api.post('finanzas', '/api/weighings', {
      purpose: 'ENTRY',
      source: 'MANUAL',
      grossGrams: 10,
      manualReason: 'sin permiso',
    });
    expect(finance.status).toBe(403);
    // Ajuste trazable de un pesaje no usado (RN-019).
    const adj = await api.post(
      'gerencia',
      `/api/weighings/${ok.body.id}/adjust`,
      { newNetGrams: 125.4, reason: 'Recalibración certificada' },
    );
    expect(adj.status).toBe(201);
    const detail = await api.get('operaciones', `/api/weighings/${ok.body.id}`);
    expect(detail.body.netGrams).toBe(125.5);
    expect(detail.body.currentNetGrams).toBe(125.4);
    expect(detail.body.adjustments).toHaveLength(1);
  });

  // ---------------------------------------------------------------- Escenario A / CA-002
  it('Escenario A / CA-002 · distribuye 1.000 g entre talleres sin perder el total global', async () => {
    const plan: [string, number, string][] = [
      ['TC', 200, 'taller.tc'],
      ['TJ', 200, 'taller.tj'],
      ['TJV', 200, 'taller.tjv'],
      ['TCA', 400, 'taller.tca'],
    ];
    const totalBefore = (await officeGrams('AU24'))!.total;
    for (const [code, grams, user] of plan) {
      const weighingId = await api.weigh(grams, 'DISPATCH', M.AU24.id);
      const d = await dispatch({
        workshopId: W[code].id,
        purpose: `Distribución 1 kg a ${code}`,
        lines: [{ materialId: M.AU24.id, weighingId }],
      });
      expect(d.body.status).toBe('PENDING_ACCEPTANCE');
      // En tránsito sigue bajo control de Prestige Gold.
      await accept(user, d.body);
    }
    const s = (await officeGrams('AU24'))!;
    expect(s.total).toBeCloseTo(totalBefore, 4);
    expect(s.workshops).toBeCloseTo(1000, 4);
    expect(byCode(s.byWorkshop, 'TCA').grams).toBeCloseTo(400, 4);
    // Cada taller ve únicamente lo que le fue entregado.
    const tc = await api.get(
      'taller.tc',
      `/api/inventory/workshops/${W.TC.id}/custody`,
    );
    expect(tc.status).toBe(200);
    expect(
      tc.body.totals.find(
        (t: { material: { code: string } }) => t.material.code === 'AU24',
      ).grams,
    ).toBeCloseTo(200, 4);
    const cross = await api.get(
      'taller.tc',
      `/api/inventory/workshops/${W.TJ.id}/custody`,
    );
    expect(cross.status).toBe(404);
    const balances = await api.get('taller.tc', '/api/inventory/balances');
    expect(
      balances.body.every(
        (b: { location: { workshopId: string } }) =>
          b.location.workshopId === W.TC.id,
      ),
    ).toBe(true);
  });

  // ---------------------------------------------------------------- Escenario C / CA-003
  let order1: { id: string; number: string };
  let childOrderId: string;

  it('CA-003 / Escenario C · detecta insuficiencia de hilo (70 g requeridos, 50 g asignados)', async () => {
    await entry('AU24', 500);
    await entry('HILO24', 50);
    const created = await api.post('operaciones', '/api/orders', {
      productId: P['GUC-CAD'].id,
      workshopId: W.TC.id,
      targetGrams: 250,
      targetUnits: 10,
      commitmentDate: '2026-12-15',
      notes: 'Cadena Gucci e2e',
    });
    expect(created.status).toBe(201);
    order1 = created.body;
    const hilo = created.body.requirements.find(
      (r: { materialId: string }) => r.materialId === M.HILO24.id,
    );
    expect(hilo.requiredGrams).toBe(70);
    expect(
      created.body.requirements.find(
        (r: { materialId: string }) => r.materialId === M.AU24.id,
      ).requiredGrams,
    ).toBe(180);
    expect(created.body.technicalSheet.versionNumber).toBe(1);

    const planned = await api.post(
      'operaciones',
      `/api/orders/${order1.id}/plan`,
    );
    expect(planned.body.status).toBe('PENDING_MATERIALS');
    const suff = await api.get(
      'operaciones',
      `/api/orders/${order1.id}/sufficiency`,
    );
    expect(
      suff.body.lines.find(
        (l: { materialCode: string }) => l.materialCode === 'HILO24',
      ).shortfallGrams,
    ).toBe(20);

    const preview = await api.post('operaciones', '/api/dispatches/preview', {
      orderId: order1.id,
      lines: [
        { materialId: M.AU24.id, grams: 180 },
        { materialId: M.HILO24.id, grams: 50 },
      ],
    });
    expect(preview.body.ok).toBe(false);
    expect(preview.body.insufficient[0]).toMatchObject({
      materialName: 'Hilo de oro 24K',
      shortfallGrams: 20,
    });
    expect(preview.body.insufficient[0].fabricationProduct.code).toBe(
      'HILO-24',
    );

    const wAu = await api.weigh(180, 'DISPATCH', M.AU24.id);
    const wHilo = await api.weigh(50, 'DISPATCH', M.HILO24.id);
    const lines = [
      { materialId: M.AU24.id, weighingId: wAu },
      { materialId: M.HILO24.id, weighingId: wHilo },
    ];
    const blocked = await dispatch(
      { orderId: order1.id, purpose: 'Producción cadena Gucci', lines },
      422,
    );
    expect(blocked.body.error).toBe('INSUFFICIENT_FOR_ORDER');
    expect(blocked.body.details.actions).toEqual(
      expect.arrayContaining([
        'COMPLETE_FROM_INVENTORY',
        'REQUEST_FABRICATION',
        'MODIFY_ORDER',
        'DISPATCH_PARTIAL',
      ]),
    );

    // Se toma la decisión "solicitar/fabricar hilo": queda trazada y genera la orden del intermedio.
    const d = await dispatch({
      orderId: order1.id,
      purpose: 'Producción cadena Gucci',
      lines,
      insufficiencyDecision: {
        action: 'REQUEST_FABRICATION',
        justification: 'Fabricar 20 g de hilo con Javier',
        fabricationWorkshopId: W.TJV.id,
      },
    });
    const detail = (await api.get('operaciones', `/api/orders/${order1.id}`))
      .body;
    expect(detail.status).toBe('DISPATCHED');
    expect(detail.decisions[0]).toMatchObject({
      action: 'REQUEST_FABRICATION',
      shortfallGrams: 20,
    });
    childOrderId = detail.decisions[0].generatedOrderId;
    expect(childOrderId).toBeTruthy();
    await accept('taller.tc', d.body);
    expect(
      (await api.get('operaciones', `/api/orders/${order1.id}`)).body.status,
    ).toBe('ACCEPTED_BY_WORKSHOP');
    const alerts = (await api.get('operaciones', '/api/alerts?type=SHORTAGE'))
      .body.items;
    expect(alerts.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------- Escenario B
  it('Escenario B · Javier fabrica el hilo, se concilia, aprueba y entra como material', async () => {
    const child = (await api.get('operaciones', `/api/orders/${childOrderId}`))
      .body;
    expect(child.product.code).toBe('HILO-24');
    expect(child.workshop.code).toBe('TJV');
    expect(child.requirements[0].requiredGrams).toBe(20.2);
    expect(
      (await api.post('operaciones', `/api/orders/${childOrderId}/plan`)).body
        .status,
    ).toBe('READY_FOR_DISPATCH');
    const w = await api.weigh(20.2, 'DISPATCH', M.AU24.id);
    const d = await dispatch({
      orderId: childOrderId,
      purpose: 'Fabricación de hilo',
      lines: [{ materialId: M.AU24.id, weighingId: w }],
    });
    await accept('taller.tjv', d.body);

    await completeStages('taller.tjv', childOrderId, 'HILO');
    const cons = await api.post(
      'taller.tjv',
      `/api/orders/${childOrderId}/consumptions`,
      { items: [{ materialId: M.AU24.id, grams: 20.2 }] },
    );
    expect(cons.status).toBe(201);
    const fin = await api.post(
      'taller.tjv',
      `/api/orders/${childOrderId}/finished`,
      {
        grams: 20,
        technicalValues: { CALIBRE: 0.8, ACABADO: 'Brillante' },
        labor: { basis: 'GRAM', quantity: 20 },
      },
    );
    expect(fin.status).toBe(201);
    expect(fin.body.status).toBe('FINISHED_BY_WORKSHOP');

    const wr = await api.weigh(20, 'RECEPTION');
    const rec = await api.post(
      'operaciones',
      `/api/orders/${childOrderId}/receipts`,
      {
        type: 'FINAL',
        lines: [{ lineType: 'FINISHED_PRODUCT', weighingId: wr }],
      },
    );
    expect(rec.status).toBe(201);
    expect(
      (
        await api.post(
          'operaciones',
          `/api/orders/${childOrderId}/receipts/${rec.body.id}/quality`,
          { result: 'APPROVED', checklist: [{ item: 'Calibre', ok: true }] },
        )
      ).status,
    ).toBe(201);
    const pv = await api.post(
      'operaciones',
      `/api/orders/${childOrderId}/receipts/${rec.body.id}/purity`,
      { method: 'XRF', obtainedValue: 999.3, supportReference: 'XRF-001' },
    );
    expect(pv.body.conforming).toBe(true);

    const gen = await api.post(
      'operaciones',
      `/api/orders/${childOrderId}/reconciliation/discrepancies`,
    );
    expect(gen.status).toBe(201);
    expect(gen.body.transformation.processLossGrams).toBeCloseTo(0.2, 4);
    expect(gen.body.balanced).toBe(true);

    const hiloBefore = (await officeGrams('HILO24'))?.office ?? 0;
    const labor = (
      await api.get(
        'gerencia',
        `/api/labor?status=PROPOSED&workshopId=${W.TJV.id}`,
      )
    ).body.items[0];
    expect(labor.proposedValue).toBe(70000);
    const approved = await api.post(
      'gerencia',
      `/api/orders/${childOrderId}/approve`,
      { labor: { decision: 'APPROVE' } },
    );
    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe('APPROVED_CLOSED');
    expect((await officeGrams('HILO24'))!.office).toBeCloseTo(
      hiloBefore + 20,
      4,
    );
    const costs = (
      await api.get('finanzas', `/api/finance/costs?orderId=${childOrderId}`)
    ).body.items;
    expect(costs.map((c: { type: string }) => c.type).sort()).toEqual([
      'LABOR',
      'MATERIAL',
    ]);
  });

  // ---------------------------------------------------------------- CA-004..006, CA-013, CA-015
  it('CA-004 · el taller confirma recepción y registra avance con fotos y videos obligatorios', async () => {
    const w = await api.weigh(20, 'DISPATCH', M.HILO24.id);
    const d = await dispatch({
      orderId: order1.id,
      purpose: 'Complemento de hilo fabricado',
      lines: [{ materialId: M.HILO24.id, weighingId: w }],
    });
    await accept('taller.tc', d.body);

    const armado = stages.find((s) => s.code === 'ARMADO')!;
    const noEvidence = await api.post(
      'taller.tc',
      `/api/orders/${order1.id}/progress`,
      { stageId: armado.id, completesStage: true },
    );
    expect(noEvidence.status).toBe(422);
    expect(noEvidence.body.error).toBe('STAGE_EVIDENCE_REQUIRED');
    const early = await api.post(
      'taller.tc',
      `/api/orders/${order1.id}/finished`,
      { grams: 240, technicalValues: { CALIBRE: 6, ACABADO: 'Brillante' } },
    );
    expect(early.status).toBe(422);
    expect(early.body.error).toBe('MANDATORY_STAGES_PENDING');

    await completeStages('taller.tc', order1.id, 'GUCCI');
    const story = await api.get(
      'operaciones',
      `/api/orders/${order1.id}/story`,
    );
    expect(story.status).toBe(200);
    expect(story.body.totals.photos).toBeGreaterThanOrEqual(6);
    expect(story.body.totals.videos).toBeGreaterThanOrEqual(2);
    expect(
      story.body.groups.find(
        (g: { stage: { code: string } }) => g.stage.code === 'ARMADO',
      ).items.length,
    ).toBeGreaterThan(0);
    // Media con firma binaria falsa: un .png que en realidad es texto.
    const fake = await api.upload(
      'taller.tc',
      { purpose: 'STAGE', productionOrderId: order1.id },
      {
        buffer: Buffer.from('no soy una imagen'),
        name: 'falsa.png',
        type: 'image/png',
      },
    );
    expect(fake.status).toBe(400);
  });

  it('RF-012/015/016 · consumos validados contra custodia y solicitudes contra estándar', async () => {
    const over = await api.post(
      'taller.tc',
      `/api/orders/${order1.id}/consumptions`,
      { items: [{ materialId: M.HILO24.id, grams: 71 }] },
    );
    expect(over.status).toBe(422);
    expect(over.body.error).toBe('CONSUMPTION_EXCEEDS_CUSTODY');
    const ok = await api.post(
      'taller.tc',
      `/api/orders/${order1.id}/consumptions`,
      {
        items: [
          { materialId: M.AU24.id, grams: 180 },
          { materialId: M.HILO24.id, grams: 70 },
        ],
      },
    );
    expect(ok.status).toBe(201);
    const req = await api.post('taller.tc', '/api/material-requests', {
      orderId: order1.id,
      materialId: M.AU24.id,
      grams: 10,
      reason: 'Reposición por fundición fallida',
    });
    expect(req.status).toBe(201);
    expect(req.body.exceedsStandard).toBe(true);
    expect(
      (await api.get('operaciones', '/api/alerts?type=REQUEST_DEVIATION')).body
        .items.length,
    ).toBeGreaterThan(0);
    const reviewed = await api.post(
      'operaciones',
      `/api/material-requests/${req.body.id}/review`,
      { decision: 'REJECT', notes: 'Excede el estándar' },
    );
    expect(reviewed.body.status).toBe('REJECTED');
  });

  it('CA-005 / CA-013 · producto terminado, recepción con ley bloqueante y aprobación', async () => {
    const fin = await api.post(
      'taller.tc',
      `/api/orders/${order1.id}/finished`,
      {
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
      },
    );
    expect(fin.status).toBe(201);
    // El taller no puede aprobar su propia producción (RN-009).
    expect(
      (await api.post('taller.tc', `/api/orders/${order1.id}/approve`, {}))
        .status,
    ).toBe(403);

    const wr = await api.weigh(245.5, 'RECEPTION');
    const rec = await api.post(
      'operaciones',
      `/api/orders/${order1.id}/receipts`,
      {
        type: 'FINAL',
        lines: [{ lineType: 'FINISHED_PRODUCT', units: 10, weighingId: wr }],
      },
    );
    expect(rec.status).toBe(201);
    expect(rec.body.comparison.differenceGrams).toBeCloseTo(0.5, 4);

    let blocked = await api.post(
      'gerencia',
      `/api/orders/${order1.id}/approve`,
      { labor: { decision: 'APPROVE' } },
    );
    expect(blocked.status).toBe(422);
    expect(blocked.body.details.blockers.join(' ')).toMatch(/ley\/pureza/);

    await api.post(
      'operaciones',
      `/api/orders/${order1.id}/receipts/${rec.body.id}/quality`,
      {
        result: 'APPROVED',
        checklist: [{ item: 'Acabado y brillo', ok: true }],
      },
    );
    const bad = await api.post(
      'operaciones',
      `/api/orders/${order1.id}/receipts/${rec.body.id}/purity`,
      { method: 'XRF', obtainedValue: 990 },
    );
    expect(bad.body.conforming).toBe(false);
    await api.post(
      'operaciones',
      `/api/orders/${order1.id}/reconciliation/discrepancies`,
    );
    blocked = await api.post('gerencia', `/api/orders/${order1.id}/approve`, {
      labor: { decision: 'APPROVE' },
    });
    expect(blocked.status).toBe(422);
    expect(blocked.body.details.blockers.join(' ')).toMatch(
      /fuera de tolerancia/,
    );

    const good = await api.post(
      'operaciones',
      `/api/orders/${order1.id}/receipts/${rec.body.id}/purity`,
      {
        method: 'FIRE_ASSAY',
        obtainedValue: 999.1,
        supportReference: 'Ensayo al fuego #77',
      },
    );
    expect(good.body.conforming).toBe(true);

    // CA-006: conciliación entregado / consumido / terminado / merma.
    const rc = (
      await api.get('operaciones', `/api/orders/${order1.id}/reconciliation`)
    ).body;
    expect(rc.transformation.totalConsumedGrams).toBe(250);
    expect(rc.transformation.finishedGrams).toBe(245.5);
    expect(rc.transformation.processLossGrams).toBeCloseTo(4.5, 4);
    expect(rc.lines.every((l: { balanced: boolean }) => l.balanced)).toBe(true);
    expect(rc.balanced).toBe(true);

    const approved = await api.post(
      'gerencia',
      `/api/orders/${order1.id}/approve`,
      {
        labor: { decision: 'APPROVE', approvedValue: 2000000 },
        updateTechnicalSheet: true,
      },
    );
    expect(approved.body.details?.blockers ?? approved.status).toBe(201);
    expect(approved.body.status).toBe('APPROVED_CLOSED');
    expect(approved.body.reconciliationSnapshot.totalCost).toBeGreaterThan(0);
    const goods = (
      await api.get('operaciones', `/api/finished-goods?orderId=${order1.id}`)
    ).body.items;
    expect(goods[0]).toMatchObject({
      status: 'AVAILABLE',
      qualityStatus: 'APPROVED',
      purityStatus: 'CONFORMING',
    });

    // CA-015 / RN-023: la ficha se versiona y la orden conserva su versión original.
    const cat = (
      await api.get('operaciones', `/api/catalog/products/${P['GUC-CAD'].id}`)
    ).body;
    expect(cat.versions.length).toBe(2);
    expect(cat.currentSheet.versionNumber).toBe(2);
    expect(cat.currentSheet.standardWeight).toBeCloseTo(24.55, 2);
    expect(cat.currentSheet.sourceOrderId).toBe(order1.id);
    expect(
      (await api.get('operaciones', `/api/orders/${order1.id}`)).body
        .technicalSheet.versionNumber,
    ).toBe(1);
  });

  // ---------------------------------------------------------------- CA-007 / CA-008 / CA-014
  let order2: { id: string };
  it('CA-008 · diferencia de peso en entrega exige justificación y aprobación', async () => {
    await entry('CADIT', 100);
    await entry('PIEDRA', 10);
    await entry('SOLD', 5);
    order2 = (
      await api.post('operaciones', '/api/orders', {
        productId: P['PUL-PIE'].id,
        workshopId: W.TJ.id,
        targetGrams: 100,
        commitmentDate: '2026-11-30',
      })
    ).body;
    expect(
      (await api.post('operaciones', `/api/orders/${order2.id}/plan`)).body
        .status,
    ).toBe('READY_FOR_DISPATCH');
    const lines = [];
    for (const [code, g] of [
      ['CADIT', 92],
      ['PIEDRA', 5],
      ['SOLD', 3],
    ] as const)
      lines.push({
        materialId: M[code].id,
        weighingId: await api.weigh(g, 'DISPATCH', M[code].id),
      });
    const d = (
      await dispatch({
        orderId: order2.id,
        purpose: 'Pulseras con piedra',
        lines,
      })
    ).body;
    const cadLine = d.lines.find(
      (l: { materialId: string }) => l.materialId === M.CADIT.id,
    );
    const accepted = await accept('taller.tj', d, { [cadLine.id]: 91.5 });
    expect(accepted.status).toBe('ACCEPTED_WITH_OBSERVATIONS');
    const disc = (
      await api.get(
        'operaciones',
        `/api/discrepancies?orderId=${order2.id}&status=PENDING`,
      )
    ).body.items[0];
    expect(disc).toMatchObject({ type: 'DISPATCH_DIFFERENCE', grams: 0.5 });
    expect(
      (
        await api.post('taller.tj', `/api/discrepancies/${disc.id}/review`, {
          decision: 'APPROVED',
        })
      ).status,
    ).toBe(403);
    const noJust = await api.post(
      'gerencia',
      `/api/discrepancies/${disc.id}/review`,
      { decision: 'APPROVED' },
    );
    expect(noJust.status).toBe(422);
    expect(noJust.body.error).toBe('JUSTIFICATION_REQUIRED');
    expect(
      (
        await api.post('operaciones', `/api/discrepancies/${disc.id}/justify`, {
          justification: 'Pérdida en empaque verificada con video',
          responsibleParty: 'Mensajería',
        })
      ).status,
    ).toBe(201);
    const ok = await api.post(
      'gerencia',
      `/api/discrepancies/${disc.id}/review`,
      { decision: 'APPROVED', notes: 'Aprobado' },
    );
    expect(ok.body.status).toBe('APPROVED');
    expect(ok.body.movementId).toBeTruthy();
    const custody = (
      await api.get('taller.tj', `/api/inventory/workshops/${W.TJ.id}/custody`)
    ).body;
    const cad = custody.byOrder.find(
      (x: { productionOrderId: string; material: { code: string } }) =>
        x.productionOrderId === order2.id && x.material.code === 'CADIT',
    );
    expect(cad.grams).toBeCloseTo(91.5, 4);
  });

  it('CA-007 · un taller no puede ver información de otro taller ni finanzas', async () => {
    expect(
      (await api.get('taller.tc', `/api/orders/${order2.id}`)).status,
    ).toBe(404);
    const list = (await api.get('taller.tc', '/api/orders?pageSize=100')).body
      .items;
    expect(
      list.every((o: { workshopId: string }) => o.workshopId === W.TC.id),
    ).toBe(true);
    expect((await api.get('taller.tc', '/api/finance/summary')).status).toBe(
      403,
    );
    expect((await api.get('taller.tc', '/api/inventory/summary')).status).toBe(
      403,
    );
    expect((await api.get('taller.tc', '/api/dashboard/office')).status).toBe(
      403,
    );
    expect(
      (await api.get('taller.tc', '/api/reports/profitability')).status,
    ).toBe(403);
    const dispatches = (
      await api.get('taller.tc', '/api/dispatches?pageSize=100')
    ).body.items;
    expect(
      dispatches.every((d: { workshopId: string }) => d.workshopId === W.TC.id),
    ).toBe(true);
    const alerts = (await api.get('taller.tj', '/api/alerts?pageSize=100')).body
      .items;
    expect(
      alerts.every((a: { workshopId: string }) => a.workshopId === W.TJ.id),
    ).toBe(true);
    const media = (await api.get('taller.tj', '/api/media?pageSize=100')).body
      .items;
    expect(
      media.every((m: { workshopId: string }) => m.workshopId === W.TJ.id),
    ).toBe(true);
    expect(
      (await api.get('taller.tj', `/api/orders/${order1.id}/story`)).status,
    ).toBe(404);
  });

  it('CA-014 · bloquea el despacho a cliente de piezas sin calidad/ley aprobada', async () => {
    // Recepción parcial de pulseras: quedan en cuarentena.
    const wr = await api.weigh(40, 'RECEPTION');
    const rec = await api.post(
      'operaciones',
      `/api/orders/${order2.id}/receipts`,
      {
        type: 'PARTIAL',
        lines: [{ lineType: 'FINISHED_PRODUCT', units: 5, weighingId: wr }],
        acknowledgeWarnings: true,
      },
    );
    expect(rec.status).toBe(201);
    expect(
      (await api.get('operaciones', `/api/orders/${order2.id}`)).body.status,
    ).toBe('PARTIAL');
    const fg = (
      await api.get('operaciones', `/api/finished-goods?orderId=${order2.id}`)
    ).body.items[0];
    expect(fg.status).toBe('QUARANTINE');
    const customers = (await api.get('operaciones', '/api/customers')).body
      .items;
    const op = (
      await api.post('operaciones', '/api/customer-operations', {
        customerId: customers[0].id,
        type: 'SALE',
        description: 'Venta pulseras',
        totalValue: 5000000,
      })
    ).body;
    const sale = await api.post('operaciones', '/api/sales', {
      operationId: op.id,
      dispatchDate: '2026-10-09',
      lines: [{ finishedGoodId: fg.id, units: 1, value: 1000000 }],
    });
    expect(sale.status).toBe(422);
    expect(sale.body.error).toBe('PRODUCT_NOT_RELEASED');
  });

  // ---------------------------------------------------------------- CA-009 / RF-025
  it('RF-025 / CA-009 · venta liberada, abono en dinero y aporte de material separados', async () => {
    const customer = (
      await api.get('operaciones', '/api/customers?search=Dorado')
    ).body.items[0];
    const op = await api.post('operaciones', '/api/customer-operations', {
      customerId: customer.id,
      type: 'CUSTOM_ORDER',
      description: 'Cadenas Gucci por encargo',
      totalValue: 30000000,
      committedMaterialFineGrams: 20,
    });
    expect(op.status).toBe(201);
    const fg = (
      await api.get('operaciones', `/api/finished-goods?orderId=${order1.id}`)
    ).body.items[0];
    const sale = await api.post('operaciones', '/api/sales', {
      operationId: op.body.id,
      dispatchDate: '2026-10-09',
      lines: [{ finishedGoodId: fg.id, units: 5, value: 15000000 }],
    });
    expect(sale.status).toBe(201);
    expect(sale.body.lines[0].grams).toBeCloseTo(122.75, 2);
    expect(sale.body.lines[0].cost).toBeGreaterThan(0);

    const methods = (await api.get('finanzas', '/api/payment-methods')).body;
    const pay = await api.post('finanzas', '/api/customer-payments', {
      customerId: customer.id,
      operationId: op.body.id,
      amount: 5000000,
      paymentMethodId: methods[0].id,
      paymentDate: '2026-10-09',
      reference: 'TRF-1',
    });
    expect(pay.status).toBe(201);
    expect(pay.body.financialTransactionId).toBeTruthy();

    const invalid = await api.post(
      'operaciones',
      '/api/customer-contributions',
      {
        customerId: customer.id,
        operationId: op.body.id,
        materialId: M.AU18.id,
        declaredPurity: 750,
        timing: 'AFTER_FABRICATION',
        origin: 'Joyas usadas',
        contributionDate: '2026-10-09',
      },
    );
    expect(invalid.status).toBe(400);
    const w = await api.weigh(12, 'CUSTOMER_MATERIAL', M.AU18.id);
    const contrib = await api.post(
      'operaciones',
      '/api/customer-contributions',
      {
        customerId: customer.id,
        operationId: op.body.id,
        materialId: M.AU18.id,
        weighingId: w,
        declaredPurity: 750,
        timing: 'AFTER_FABRICATION',
        origin: 'Joyas usadas del cliente',
        contributionDate: '2026-10-09',
        pricePerGram: 400000,
      },
    );
    expect(contrib.status).toBe(201);
    expect(contrib.body.fineGrams).toBe(9);
    expect(contrib.body.valuation).toBe(3600000);

    const account = (
      await api.get('finanzas', `/api/customers/${customer.id}/account`)
    ).body;
    const b = account.operations.find(
      (o: { id: string }) => o.id === op.body.id,
    ).balances;
    expect(b.money).toMatchObject({
      totalValue: 30000000,
      paid: 5000000,
      balance: 25000000,
      dispatchedValue: 15000000,
    });
    expect(b.material).toMatchObject({
      committedFineGrams: 20,
      contributedFineGrams: 9,
      balanceFineGrams: 11,
      valuation: 3600000,
    });
    // El material del cliente entró al inventario con su lote y trazabilidad.
    const kardex = (
      await api.get(
        'operaciones',
        `/api/inventory/kardex?materialId=${M.AU18.id}`,
      )
    ).body;
    expect(
      kardex.lines.some(
        (l: { type: string }) => l.type === 'CUSTOMER_CONTRIBUTION',
      ),
    ).toBe(true);
  });

  // ---------------------------------------------------------------- CA-010 / CA-011 / RF-040
  it('CA-010 / CA-011 / RF-040 · productividad, rentabilidad y exportación a Excel/CSV', async () => {
    const prod = (await api.get('gerencia', '/api/reports/productivity')).body;
    const workshops = prod.charts.byWorkshop
      .map((x: { workshop: string }) => x.workshop)
      .join(' ');
    expect(workshops).toMatch(/TC/);
    expect(workshops).toMatch(/TJV/);
    const profit = (
      await api.get('gerencia', '/api/reports/profitability?groupBy=product')
    ).body;
    expect(profit.summary.revenue).toBe(15000000);
    expect(profit.summary.productionLaborCost).toBe(2070000);
    expect(profit.summary.consolidatedNet).toBeCloseTo(
      15000000 -
        Number(profit.summary.productionMaterialCost) -
        2070000 -
        Number(profit.summary.operatingExpenses),
      2,
    );
    const xlsx = await api.http
      .get('/api/reports/productivity/export?format=xlsx')
      .set('Authorization', `Bearer ${await api.token('gerencia')}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    const csv = await api.http
      .get('/api/reports/losses/export?format=csv')
      .set('Authorization', `Bearer ${await api.token('gerencia')}`);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain('Gramos');
    for (const key of [
      'inventory-global',
      'workshop-material',
      'orders',
      'compliance',
      'consumption-vs-standard',
      'losses',
      'production-costs',
      'customers',
      'audit',
      'catalog',
      'visual-traceability',
      'purity-control',
    ]) {
      const r = await api.get('gerencia', `/api/reports/${key}`);
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.rows)).toBe(true);
    }
    const kardex = await api.get(
      'gerencia',
      `/api/reports/kardex?materialId=${M.AU24.id}`,
    );
    expect(kardex.body.rows.length).toBeGreaterThan(0);
    // Operaciones no ve reportes financieros.
    expect(
      (await api.get('operaciones', '/api/reports/profitability')).status,
    ).toBe(403);
    const dash = (await api.get('operaciones', '/api/dashboard/office')).body;
    expect(dash.kpis.totalInventoryGrams).toBeGreaterThan(0);
    expect(dash.kpis.salesThisMonth).toBeNull();
    expect(
      (await api.get('gerencia', '/api/dashboard/office')).body.kpis
        .salesThisMonth,
    ).toBe(15000000);
  });

  // ---------------------------------------------------------------- CA-016 / RN-024
  it('CA-016 / RN-024 · historia visual completa, enlace público y evidencias protegidas', async () => {
    const story = (await api.get('gerencia', `/api/orders/${order1.id}/story`))
      .body;
    const codes = story.groups
      .filter((g: { items: unknown[] }) => g.items.length)
      .map((g: { stage: { code: string } }) => g.stage.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'FUNDICION',
        'ARMADO',
        'SOLDADURA',
        'PULIDO',
        'TERMINADO',
      ]),
    );
    const share = await api.post(
      'gerencia',
      `/api/orders/${order1.id}/story/shares`,
      { title: 'Tu cadena Gucci' },
    );
    expect(share.status).toBe(201);
    const pub = await api.http.get(`/api/public/stories/${share.body.token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.order.workshop).toBeUndefined();
    expect(pub.body.timeline.length).toBeGreaterThan(0);
    // El contenido se sirve con URL firmada; sin firma válida → 403.
    const url: string = pub.body.timeline[0].urls.web;
    expect((await api.http.get(url)).status).toBe(200);
    // RNF-009: los videos se sirven por rangos (reproducción/adelanto en móvil).
    const videoItem = (story.timeline as { kind: string; urls: { original: string } }[]).find((m) => m.kind === 'VIDEO');
    expect(videoItem).toBeTruthy();
    const partial = await api.http.get(videoItem!.urls.original).set('Range', 'bytes=0-9');
    expect(partial.status).toBe(206);
    expect(partial.headers['content-range']).toMatch(/^bytes 0-9\//);
    expect(
      (await api.http.get(url.replace(/sig=[^&]+/, 'sig=manipulada'))).status,
    ).toBe(403);
    const mediaId = story.timeline[0].id;
    const hide = await api.post('taller.tc', `/api/media/${mediaId}/hide`, {
      reason: 'Quiero borrarla',
    });
    expect([403, 422]).toContain(hide.status);
    const modHide = await api.post('gerencia', `/api/media/${mediaId}/hide`, {
      reason: 'Foto con datos sensibles',
    });
    expect(modHide.status).toBe(201);
    expect(modHide.body.hidden).toBe(true);
  });

  // ---------------------------------------------------------------- RN-015 / auditoría / finanzas
  it('RN-015 · los movimientos aprobados no se borran: se reversan con auditoría', async () => {
    const mv = await entry('AU24', 5);
    const rev = await api.post(
      'admin',
      `/api/inventory/movements/${mv.id}/reverse`,
      { reason: 'Entrada duplicada' },
    );
    expect(rev.status).toBe(201);
    expect(rev.body.type).toBe('REVERSAL');
    expect(
      (
        await api.post('admin', `/api/inventory/movements/${mv.id}/reverse`, {
          reason: 'Otra vez',
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await api.post(
          'operaciones',
          `/api/inventory/movements/${mv.id}/reverse`,
          { reason: 'Sin permiso' },
        )
      ).status,
    ).toBe(403);
    const audit = (await api.get('auditor', `/api/audit?entityId=${mv.id}`))
      .body.items;
    expect(audit.map((a: { action: string }) => a.action)).toEqual(
      expect.arrayContaining(['CREATE', 'REVERSE']),
    );
    expect(
      (await api.get('auditor', '/api/audit?action=STATUS_CHANGE')).body.total,
    ).toBeGreaterThan(5);
  });

  it('RF-028 / RN-020 · ingresos, egresos, pagos a talleres y cierre de período', async () => {
    const cats: { id: string; code: string }[] = (
      await api.get('finanzas', '/api/finance-categories')
    ).body;
    const opex = byCode(cats, 'GASTO_OPERATIVO');
    const payTaller = byCode(cats, 'PAGO_TALLER');
    const methods = (await api.get('finanzas', '/api/payment-methods')).body;
    const exp = await api.post('finanzas', '/api/finance/transactions', {
      type: 'EXPENSE',
      categoryId: opex.id,
      concept: 'Papelería',
      amount: 150000,
      transactionDate: '2026-10-05',
      supportReference: 'FAC-99',
      paymentMethodId: methods[0].id,
    });
    expect(exp.status).toBe(201);
    const wrongType = await api.post('finanzas', '/api/finance/transactions', {
      type: 'INCOME',
      categoryId: opex.id,
      concept: 'X',
      amount: 1,
      transactionDate: '2026-10-05',
    });
    expect(wrongType.status).toBe(400);
    expect(
      (
        await api.post('finanzas', '/api/finance/transactions', {
          type: 'EXPENSE',
          categoryId: payTaller.id,
          concept: 'Pago mano de obra hilo',
          amount: 70000,
          transactionDate: '2026-10-06',
          workshopId: W.TJV.id,
          paymentMethodId: methods[0].id,
        })
      ).status,
    ).toBe(201);
    const payables = (
      await api.get('finanzas', '/api/finance/workshop-payables')
    ).body;
    expect(
      payables.find(
        (p: { workshop: { code: string } }) => p.workshop.code === 'TJV',
      ).balance,
    ).toBe(0);
    expect(
      payables.find(
        (p: { workshop: { code: string } }) => p.workshop.code === 'TC',
      ).balance,
    ).toBe(2000000);
    const summary = (
      await api.get(
        'finanzas',
        '/api/finance/summary?from=2026-10-01&to=2026-10-31',
      )
    ).body;
    expect(summary.income).toBe(5000000);
    expect(summary.expense).toBe(220000);
    const close = await api.post('finanzas', '/api/finance/period-closes', {
      period: '2026-09',
    });
    expect(close.status).toBe(201);
    const late = await api.post('finanzas', '/api/finance/transactions', {
      type: 'EXPENSE',
      categoryId: opex.id,
      concept: 'Gasto tardío',
      amount: 1000,
      transactionDate: '2026-09-20',
    });
    expect(late.status).toBe(422);
    expect(late.body.error).toBe('PERIOD_CLOSED');
    // Reverso del egreso: deja de contar en caja.
    expect(
      (
        await api.post(
          'admin',
          `/api/finance/transactions/${exp.body.id}/reverse`,
          { reason: 'Registrado por error' },
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await api.get(
          'finanzas',
          '/api/finance/summary?from=2026-10-01&to=2026-10-31',
        )
      ).body.expense,
    ).toBe(70000);
  });

  it('Cancelación con control de materiales y alertas operativas', async () => {
    const draft = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC.id,
        targetGrams: 50,
        commitmentDate: '2026-10-01',
      })
    ).body;
    expect(
      (
        await api.post('operaciones', `/api/orders/${draft.id}/cancel`, {
          reason: 'Cliente desistió',
        })
      ).body.status,
    ).toBe('CANCELLED');
    // Orden con material en custodia no se cancela sin retorno.
    const cancel2 = await api.post(
      'operaciones',
      `/api/orders/${order2.id}/cancel`,
      { reason: 'Prueba' },
    );
    expect(cancel2.status).toBe(422);
    // Taller no habilitado para el producto.
    const notEnabled = await api.post('operaciones', '/api/orders', {
      productId: P['ANI-CL'].id,
      workshopId: W.TJ.id,
      targetGrams: 10,
      commitmentDate: '2026-12-01',
    });
    expect(notEnabled.status).toBe(400);
    const run = await api.post('operaciones', '/api/alerts/run-checks');
    expect(run.status).toBe(201);
    const counts = (await api.get('gerencia', '/api/alerts/counts')).body;
    expect(counts.open).toBeGreaterThan(0);
  });

  it('Panel de taller (P07) muestra solo su información y tareas', async () => {
    const dash = (await api.get('taller.tj', '/api/workshop-portal/dashboard'))
      .body;
    expect(dash.workshop.code).toBe('TJ');
    expect(
      dash.orders.every(
        (o: { workshopId: string }) => o.workshopId === W.TJ.id,
      ),
    ).toBe(true);
    expect(dash.tasks.some((t: { type: string }) => t.type === 'PRODUCE')).toBe(
      true,
    );
    expect(
      (await api.get('operaciones', '/api/workshop-portal/dashboard')).status,
    ).toBe(403);
  });
});
