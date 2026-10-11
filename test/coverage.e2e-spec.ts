import { INestApplication } from '@nestjs/common';
import { readdir, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MediaStorageService } from '../src/modules/media/media-storage.service';
import { Api, byCode, createApp, mp4File, pngFile } from './helpers';

/**
 * Cobertura exigida por la auditoría independiente: cada caso afirma el contenido
 * concreto que pide el texto del documento (no solo el código de estado).
 */
describe('Prestige Gold · cobertura auditada contra el documento (e2e)', () => {
  let app: INestApplication;
  let api: Api;
  const M: Record<string, { id: string; referenceCost: number }> = {};
  const W: Record<string, string> = {};
  const P: Record<
    string,
    { id: string; variants: { id: string; code: string }[] }
  > = {};
  let stages: {
    id: string;
    code: string;
    families: { code: string }[];
    isFinal: boolean;
    requiresVideo: boolean;
  }[] = [];
  let tcUserId = '';
  const sold = { opLabel: '', customer: '', customerId: '', value: 0 };
  const closed: {
    id: string;
    number: string;
    consumed: number;
    finished: number;
    labor: number;
    req: number;
  } = { id: '', number: '', consumed: 0, finished: 0, labor: 0, req: 0 };

  beforeAll(async () => {
    app = await createApp();
    api = new Api(app);
    const mats = (await api.get('admin', '/api/materials?pageSize=100')).body
      .items;
    for (const c of ['AU18', 'AU24'])
      M[c] = byCode(mats, c) as unknown as (typeof M)[string];
    const ws = (await api.get('admin', '/api/workshops?pageSize=50')).body
      .items;
    for (const c of ['TC', 'TJ']) W[c] = byCode(ws, c).id;
    const ps = (await api.get('admin', '/api/products?pageSize=50')).body.items;
    for (const c of ['ANI-CL', 'GUC-CAD'])
      P[c] = byCode(ps, c) as unknown as (typeof P)[string];
    stages = (await api.get('admin', '/api/production-stages')).body;
    tcUserId = (await api.get('taller.tc', '/api/auth/me')).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const weigh = (g: number, purpose: string, materialId?: string) =>
    api.weigh(Math.round(g * 10000) / 10000, purpose, materialId);

  interface Opts {
    grams?: number;
    consumeDelta?: number;
    returnLeftover?: number;
    skipQuality?: boolean;
    pendingDispatch?: boolean;
    commitment?: string;
    purity?: number;
  }

  /** Lleva una orden de anillos (TC) hasta "En revisión" con recepción final, calidad y ley. */
  async function produceToReview(o: Opts = {}) {
    const grams = o.grams ?? 10;
    const req = Math.round(grams * 1.02 * 10000) / 10000;
    await api.post('operaciones', '/api/inventory/entries', {
      materialId: M.AU18.id,
      weighingId: await weigh(req + 2, 'ENTRY', M.AU18.id),
      origin: 'Cobertura e2e',
    });
    const order = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
        targetGrams: grams,
        targetUnits: 2,
        commitmentDate: o.commitment ?? '2026-12-31',
        notes: 'Cobertura',
      })
    ).body;
    expect(
      (await api.post('operaciones', `/api/orders/${order.id}/plan`)).body
        .status,
    ).toBe('READY_FOR_DISPATCH');
    const d = (
      await api.post('operaciones', '/api/dispatches', {
        orderId: order.id,
        purpose: 'Cobertura',
        lines: [
          {
            materialId: M.AU18.id,
            weighingId: await weigh(req, 'DISPATCH', M.AU18.id),
          },
        ],
      })
    ).body;
    await api.post('taller.tc', `/api/dispatches/${d.id}/respond`, {
      decision: 'ACCEPT',
      signerName: 'Colmenares',
      acceptCommitment: true,
      lines: [{ lineId: d.lines[0].id, receivedGrams: req }],
    });
    // Avance parcial por gramos/unidades (RF-013).
    expect(
      (
        await api.post('taller.tc', `/api/orders/${order.id}/progress`, {
          grams: 3,
          units: 1,
          percent: 30,
          notes: 'Primer anillo fundido',
        })
      ).status,
    ).toBe(201);
    const png = await pngFile();
    for (const s of stages.filter(
      (x) =>
        x.families.length === 0 || x.families.some((f) => f.code === 'ANILLOS'),
    )) {
      await api.upload(
        'taller.tc',
        {
          purpose: s.isFinal ? 'FINISHED' : 'STAGE',
          productionOrderId: order.id,
          stageId: s.id,
        },
        png,
      );
      if (s.isFinal)
        await api.upload(
          'taller.tc',
          { purpose: 'FINISHED', productionOrderId: order.id, stageId: s.id },
          png,
        );
      if (s.requiresVideo) {
        if (!s.isFinal) {
          // RN-013: una etapa que exige video no se completa solo con foto.
          const onlyPhoto = await api.post(
            'taller.tc',
            `/api/orders/${order.id}/progress`,
            { stageId: s.id, completesStage: true },
          );
          expect(onlyPhoto.status).toBe(422);
          expect(JSON.stringify(onlyPhoto.body.details.missing)).toContain(
            'video',
          );
        }
        await api.upload(
          'taller.tc',
          { purpose: 'STAGE', productionOrderId: order.id, stageId: s.id },
          mp4File(),
        );
      }
      if (!s.isFinal)
        expect(
          (
            await api.post('taller.tc', `/api/orders/${order.id}/progress`, {
              stageId: s.id,
              completesStage: true,
            })
          ).status,
        ).toBe(201);
    }
    if (o.returnLeftover) {
      await api.post('operaciones', `/api/orders/${order.id}/receipts`, {
        type: 'PARTIAL',
        lines: [
          {
            lineType: 'LEFTOVER',
            materialId: M.AU18.id,
            weighingId: await weigh(o.returnLeftover, 'RECEPTION', M.AU18.id),
          },
        ],
      });
    }
    const consumed =
      Math.round(
        (req - (o.returnLeftover ?? 0) + (o.consumeDelta ?? 0)) * 10000,
      ) / 10000;
    expect(
      (
        await api.post('taller.tc', `/api/orders/${order.id}/consumptions`, {
          items: [{ materialId: M.AU18.id, grams: consumed }],
        })
      ).status,
    ).toBe(201);
    if (o.pendingDispatch) {
      await api.post('operaciones', '/api/inventory/entries', {
        materialId: M.AU18.id,
        weighingId: await weigh(1, 'ENTRY', M.AU18.id),
        origin: 'Extra',
      });
      await api.post('operaciones', '/api/dispatches', {
        orderId: order.id,
        purpose: 'Extra pendiente',
        lines: [
          {
            materialId: M.AU18.id,
            weighingId: await weigh(0.5, 'DISPATCH', M.AU18.id),
          },
        ],
      });
    }
    const finished = Math.round(consumed * 0.985 * 10000) / 10000;
    // RF-017: sin variables técnicas requeridas el terminado se rechaza.
    const noVars = await api.post(
      'taller.tc',
      `/api/orders/${order.id}/finished`,
      { grams: finished, units: 2 },
    );
    expect(noVars.status).toBe(422);
    expect(noVars.body.error).toBe('TECHNICAL_VARIABLES_REQUIRED');
    expect(
      (
        await api.post('taller.tc', `/api/orders/${order.id}/finished`, {
          grams: finished,
          units: 2,
          technicalValues: { CALIBRE: 1.8, ACABADO: 'Brillante' },
          labor: { basis: 'GRAM', quantity: finished },
        })
      ).status,
    ).toBe(201);
    const rec = (
      await api.post('operaciones', `/api/orders/${order.id}/receipts`, {
        type: 'FINAL',
        acknowledgeWarnings: true,
        lines: [
          {
            lineType: 'FINISHED_PRODUCT',
            units: 2,
            weighingId: await weigh(finished, 'RECEPTION'),
          },
        ],
      })
    ).body;
    if (!o.skipQuality)
      await api.post(
        'operaciones',
        `/api/orders/${order.id}/receipts/${rec.id}/quality`,
        { result: 'APPROVED', checklist: [{ item: 'Acabado', ok: true }] },
      );
    await api.post(
      'operaciones',
      `/api/orders/${order.id}/receipts/${rec.id}/purity`,
      {
        method: 'XRF',
        obtainedValue: o.purity ?? 751,
        supportReference: 'XRF-COB',
      },
    );
    return {
      order,
      req,
      consumed,
      finished,
      receiptId: rec.id,
      dispatchId: d.id,
    };
  }

  /** Orden de anillos (TC) planificada, despachada y aceptada (En producción). */
  async function dispatched(grams: number, deliver?: number) {
    const give = deliver ?? Math.round(grams * 1.02 * 10000) / 10000;
    await api.post('operaciones', '/api/inventory/entries', {
      materialId: M.AU18.id,
      weighingId: await weigh(give + 1, 'ENTRY', M.AU18.id),
      origin: 'Cobertura e2e',
    });
    const order = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
        targetGrams: grams,
        targetUnits: 2,
        commitmentDate: '2026-12-31',
      })
    ).body;
    await api.post('operaciones', `/api/orders/${order.id}/plan`);
    const d = (
      await api.post('operaciones', '/api/dispatches', {
        orderId: order.id,
        purpose: 'Cobertura',
        lines: [
          {
            materialId: M.AU18.id,
            weighingId: await weigh(give, 'DISPATCH', M.AU18.id),
          },
        ],
      })
    ).body;
    expect(
      (
        await api.post('taller.tc', `/api/dispatches/${d.id}/respond`, {
          decision: 'ACCEPT',
          signerName: 'Colmenares',
          acceptCommitment: true,
          lines: [{ lineId: d.lines[0].id, receivedGrams: give }],
        })
      ).status,
    ).toBe(201);
    return { order, give };
  }

  const approve = (id: string) =>
    api.post('gerencia', `/api/orders/${id}/approve`, {
      labor: { decision: 'APPROVE' },
    });

  it('[RF-024] [VC-09] los costos y cuentas por pagar de taller no cambian hasta la aprobación', async () => {
    const before = (
      await api.get('finanzas', '/api/finance/workshop-payables')
    ).body.find(
      (p: { workshop: { code: string } }) => p.workshop.code === 'TC',
    ).balance;
    const r = await produceToReview();
    expect(
      (await api.get('finanzas', `/api/finance/costs?orderId=${r.order.id}`))
        .body.total,
    ).toBe(0);
    const labor = (
      await api.get('gerencia', `/api/labor?status=PROPOSED&workshopId=${W.TC}`)
    ).body.items.find((l: { orderId: string }) => l.orderId === r.order.id);
    expect(labor.status).toBe('PROPOSED');
    expect(
      (await api.get('finanzas', '/api/finance/workshop-payables')).body.find(
        (p: { workshop: { code: string } }) => p.workshop.code === 'TC',
      ).balance,
    ).toBe(before);
    await api.post(
      'operaciones',
      `/api/orders/${r.order.id}/reconciliation/discrepancies`,
    );
    expect((await approve(r.order.id)).status).toBe(201);
    const costs = (
      await api.get('finanzas', `/api/finance/costs?orderId=${r.order.id}`)
    ).body.items;
    // RF-029: el costo de material se recalcula de forma independiente (consumido × costo de referencia).
    const mat = costs.find((c: { type: string }) => c.type === 'MATERIAL');
    expect(mat.amount).toBeCloseTo(
      Math.round(r.consumed * M.AU18.referenceCost * 100) / 100,
      2,
    );
    const lab = costs.find((c: { type: string }) => c.type === 'LABOR');
    expect(lab.amount).toBe(labor.proposedValue);
    const after = (
      await api.get('finanzas', '/api/finance/workshop-payables')
    ).body.find(
      (p: { workshop: { code: string } }) => p.workshop.code === 'TC',
    ).balance;
    expect(after).toBeCloseTo(before + labor.proposedValue, 2);
    Object.assign(closed, {
      id: r.order.id,
      number: r.order.number,
      consumed: r.consumed,
      finished: r.finished,
      labor: labor.proposedValue,
      req: r.req,
    });
  });

  it('[RF-013] el avance parcial se registra en gramos, unidades y observaciones', async () => {
    const detail = (await api.get('operaciones', `/api/orders/${closed.id}`))
      .body;
    expect(detail.progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grams: 3,
          units: 1,
          percent: 30,
          notes: 'Primer anillo fundido',
        }),
      ]),
    );
    // 7.1: la orden pasó por "En producción" y quedó "Aprobada/Cerrada".
    const states = detail.history.map((h: { toStatus: string }) => h.toStatus);
    expect(states).toEqual(
      expect.arrayContaining([
        'IN_PRODUCTION',
        'FINISHED_BY_WORKSHOP',
        'IN_REVIEW',
        'APPROVED_CLOSED',
      ]),
    );
  });

  it('[RN-010] una diferencia pendiente bloquea el cierre hasta justificarla y aprobarla', async () => {
    const r = await produceToReview();
    await api.post(
      'operaciones',
      `/api/orders/${r.order.id}/reconciliation/discrepancies`,
    );
    const manual = (
      await api.post('operaciones', `/api/orders/${r.order.id}/discrepancies`, {
        type: 'OTHER',
        grams: 0.02,
        reason: 'Diferencia observada en control',
      })
    ).body;
    const blocked = await approve(r.order.id);
    expect(blocked.status).toBe(422);
    expect(blocked.body.details.blockers.join(' ')).toMatch(/pendiente/);
    await api.post('operaciones', `/api/discrepancies/${manual.id}/justify`, {
      justification: 'Polvo de pulido recuperado',
    });
    await api.post('gerencia', `/api/discrepancies/${manual.id}/review`, {
      decision: 'APPROVED',
    });
    expect((await approve(r.order.id)).status).toBe(201);
  });

  it('[RN-011] [VC-08] no se cierra con entregas pendientes, recepción incompleta o conciliación sin resolver', async () => {
    // Conciliación sin resolver + entrega pendiente de aceptación.
    const r = await produceToReview({
      consumeDelta: -0.5,
      pendingDispatch: true,
    });
    const blocked = await approve(r.order.id);
    expect(blocked.status).toBe(422);
    const text = blocked.body.details.blockers.join(' ');
    expect(text).toMatch(/entregas pendientes/);
    expect(text).toMatch(/sin explicar/);
    // Recepción incompleta: con solo una recepción PARCIAL de producto la orden queda "Parcial" y no se aprueba.
    const part = await dispatched(10);
    const w = await weigh(4, 'RECEPTION');
    expect(
      (
        await api.post('operaciones', `/api/orders/${part.order.id}/receipts`, {
          type: 'PARTIAL',
          acknowledgeWarnings: true,
          lines: [{ lineType: 'FINISHED_PRODUCT', units: 1, weighingId: w }],
        })
      ).status,
    ).toBe(201);
    expect(
      (await api.get('operaciones', `/api/orders/${part.order.id}`)).body
        .status,
    ).toBe('PARTIAL');
    const partial = await approve(part.order.id);
    expect(partial.status).toBe(409);
    expect(JSON.stringify(partial.body)).toMatch(/Parcial/);
  });

  it('[RF-022] [VC-07] una diferencia dentro de tolerancia se aprueba automáticamente y fuera de ella queda pendiente', async () => {
    const inside = await produceToReview({ consumeDelta: -0.005 });
    const a = (
      await api.post(
        'operaciones',
        `/api/orders/${inside.order.id}/reconciliation/discrepancies`,
      )
    ).body;
    expect(
      a.discrepancies.find(
        (d: { type: string }) => d.type === 'CUSTODY_SHORTAGE',
      ),
    ).toMatchObject({
      status: 'APPROVED',
      autoApproved: true,
      withinTolerance: true,
    });
    const outside = await produceToReview({ consumeDelta: -0.4 });
    const b = (
      await api.post(
        'operaciones',
        `/api/orders/${outside.order.id}/reconciliation/discrepancies`,
      )
    ).body;
    expect(
      b.discrepancies.find(
        (d: { type: string }) => d.type === 'CUSTODY_SHORTAGE',
      ),
    ).toMatchObject({ status: 'PENDING', withinTolerance: false, grams: 0.4 });
    expect(b.balanced).toBe(false);
    // RF-039: la diferencia fuera de tolerancia genera alerta crítica.
    const pendingId = b.discrepancies.find(
      (d: { type: string }) => d.type === 'CUSTODY_SHORTAGE',
    ).id;
    const diffs = (
      await api.get('operaciones', '/api/alerts?type=DIFFERENCE&pageSize=100')
    ).body.items;
    expect(
      diffs.find((a: { entityId: string }) => a.entityId === pendingId),
    ).toMatchObject({ severity: 'CRITICAL' });
  });

  it('[RF-021] [CA-006] la conciliación cuadra entregado = consumido + retornado + diferencias', async () => {
    const r = await produceToReview({ returnLeftover: 0.6 });
    const rec = (
      await api.post(
        'operaciones',
        `/api/orders/${r.order.id}/reconciliation/discrepancies`,
      )
    ).body;
    const line = rec.lines[0];
    expect(line.deliveredGrams).toBeCloseTo(r.req, 4);
    expect(line.returnedGrams).toBeCloseTo(0.6, 4);
    expect(line.consumedGrams).toBeCloseTo(r.consumed, 4);
    expect(line.deliveredGrams).toBeCloseTo(
      line.consumedGrams + line.returnedGrams + line.approvedDifferenceGrams,
      4,
    );
    expect(rec.transformation.processLossGrams).toBeCloseTo(
      r.consumed - r.finished,
      4,
    );
    expect(rec.balanced).toBe(true);
  });

  it('[RF-019] sin control de calidad aprobado la recepción no se aprueba', async () => {
    const r = await produceToReview({ skipQuality: true });
    await api.post(
      'operaciones',
      `/api/orders/${r.order.id}/reconciliation/discrepancies`,
    );
    const blocked = await approve(r.order.id);
    expect(blocked.status).toBe(422);
    expect(blocked.body.details.blockers.join(' ')).toMatch(/calidad/);
  });

  it('[7.1] devolución a ajuste (Rechazada/Ajuste) y nueva declaración del taller', async () => {
    const r = await produceToReview();
    expect(
      (
        await api.post('gerencia', `/api/orders/${r.order.id}/reject`, {
          reason: 'Corregir medidas de talla',
        })
      ).body.status,
    ).toBe('REJECTED_ADJUSTMENT');
    const again = await api.post(
      'taller.tc',
      `/api/orders/${r.order.id}/finished`,
      {
        grams: r.finished,
        units: 2,
        technicalValues: { CALIBRE: 1.8, ACABADO: 'Mate' },
      },
    );
    expect(again.body.status).toBe('FINISHED_BY_WORKSHOP');
    expect(
      (
        await api.post(
          'operaciones',
          `/api/orders/${r.order.id}/send-to-review`,
        )
      ).body.status,
    ).toBe('IN_REVIEW');
  });

  it('[RF-001] [RF-003] la entrada conserva tipo, ley, origen, fecha, responsable y documento; la captura manual queda auditada', async () => {
    const w = (
      await api.post('operaciones', '/api/weighings', {
        purpose: 'ENTRY',
        source: 'MANUAL',
        grossGrams: 12.5,
        materialId: M.AU24.id,
        manualReason: 'Balanza en mantenimiento',
      })
    ).body;
    expect(w.source).toBe('MANUAL');
    const mv = (
      await api.post('operaciones', '/api/inventory/entries', {
        materialId: M.AU24.id,
        weighingId: w.id,
        origin: 'Proveedor Andino',
        reference: 'FAC-7788',
        purity: 998,
      })
    ).body;
    const detail = (
      await api.get('operaciones', `/api/inventory/movements/${mv.id}`)
    ).body;
    expect(detail).toMatchObject({
      type: 'ENTRY',
      grams: 12.5,
      purity: 998,
      origin: 'Proveedor Andino',
      reference: 'FAC-7788',
      weighingId: w.id,
    });
    expect(detail.material.code).toBe('AU24');
    expect(detail.responsible.fullName).toBe('Cristian Ayala');
    expect(new Date(detail.createdAt).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    const audit = (
      await api.get('auditor', `/api/audit?entityId=${w.id}&action=OVERRIDE`)
    ).body.items;
    expect(audit[0].description).toContain('Balanza en mantenimiento');
    expect(audit[0].username).toBe('operaciones');
  });

  it('[RF-010] [RF-011] [RF-035] el despacho guarda responsable, peso y destino; la aceptación, usuario y fecha', async () => {
    const detail = (await api.get('operaciones', `/api/orders/${closed.id}`))
      .body;
    const d = (
      await api.get('operaciones', `/api/dispatches/${detail.dispatches[0].id}`)
    ).body;
    expect(d.responsible.fullName).toBe('Cristian Ayala');
    expect(d.workshop.code).toBe('TC');
    expect(d.lines[0].grams).toBeCloseTo(closed.req, 4);
    expect(d.lines[0].weighing.netGrams).toBeCloseTo(closed.req, 4);
    expect(d.lines[0].weighing.id).toBeTruthy();
    expect(d.acceptance.userId).toBe(tcUserId);
    expect(new Date(d.acceptance.signedAt).getTime()).toBeGreaterThan(
      Date.now() - 600_000,
    );
  });

  it('[RF-014] cada evidencia queda ligada a orden, producto, taller, fecha y etapa', async () => {
    const media = (
      await api.get(
        'operaciones',
        `/api/media?productionOrderId=${closed.id}&pageSize=50`,
      )
    ).body.items;
    expect(media.length).toBeGreaterThanOrEqual(7);
    for (const m of media) {
      expect(m).toMatchObject({
        productionOrderId: closed.id,
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
      });
      expect(m.capturedAt).toBeTruthy();
      expect(m.stageId).toBeTruthy();
    }
  });

  it('[RF-041] la historia visual está ordenada cronológicamente y por etapa', async () => {
    const story = (
      await api.get('operaciones', `/api/orders/${closed.id}/story`)
    ).body;
    const times = story.timeline.map((m: { capturedAt: string }) =>
      new Date(m.capturedAt).getTime(),
    );
    expect(times).toEqual([...times].sort((a, b) => a - b));
    const seq = story.groups.map(
      (g: { stage: { sequence: number } }) => g.stage.sequence,
    );
    expect(seq).toEqual([...seq].sort((a, b) => a - b));
  });

  it('[RN-014] un taller no puede modificar operaciones asignadas a otro taller', async () => {
    const r = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
        targetGrams: 5,
        commitmentDate: '2026-12-31',
      })
    ).body;
    expect(
      (
        await api.post('taller.tj', `/api/orders/${r.id}/consumptions`, {
          items: [{ materialId: M.AU18.id, grams: 1 }],
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api.post('taller.tj', `/api/orders/${r.id}/progress`, {
          percent: 10,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api.post('taller.tj', `/api/orders/${r.id}/finished`, {
          grams: 1,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await api.upload(
          'taller.tj',
          { purpose: 'STAGE', productionOrderId: r.id },
          await pngFile(),
        )
      ).status,
    ).toBe(404);
  });

  it('[RF-016] una solicitud dentro del estándar no se marca como desviada', async () => {
    const r = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
        targetGrams: 10,
        commitmentDate: '2026-12-31',
      })
    ).body;
    await api.post('operaciones', '/api/inventory/entries', {
      materialId: M.AU18.id,
      weighingId: await weigh(12, 'ENTRY', M.AU18.id),
      origin: 'Solicitud',
    });
    await api.post('operaciones', `/api/orders/${r.id}/plan`);
    const d = (
      await api.post('operaciones', '/api/dispatches', {
        orderId: r.id,
        purpose: 'Solicitud',
        lines: [
          {
            materialId: M.AU18.id,
            weighingId: await weigh(10, 'DISPATCH', M.AU18.id),
          },
        ],
        insufficiencyDecision: {
          action: 'DISPATCH_PARTIAL',
          justification: 'Entrega parcial planificada',
        },
      })
    ).body;
    await api.post('taller.tc', `/api/dispatches/${d.id}/respond`, {
      decision: 'ACCEPT',
      signerName: 'Colmenares',
      acceptCommitment: true,
      lines: [{ lineId: d.lines[0].id, receivedGrams: 10 }],
    });
    const req = (
      await api.post('taller.tc', '/api/material-requests', {
        orderId: r.id,
        materialId: M.AU18.id,
        grams: 0.2,
        reason: 'Completar estándar',
      })
    ).body;
    expect(req).toMatchObject({
      exceedsStandard: false,
      expectedGrams: 10.2,
      alreadyDeliveredGrams: 10,
    });
  });

  it('[RN-006] la orden exige producto, objetivo y compromiso de entrega', async () => {
    const base = {
      productId: P['ANI-CL'].id,
      workshopId: W.TC,
      targetGrams: 5,
      commitmentDate: '2026-12-31',
    };
    for (const missing of [
      'productId',
      'targetGrams',
      'commitmentDate',
      'workshopId',
    ]) {
      const body: Record<string, unknown> = { ...base };
      delete body[missing];
      expect((await api.post('operaciones', '/api/orders', body)).status).toBe(
        400,
      );
    }
  });

  it('[RF-007] la orden guarda variante, objetivo, taller, fecha y observaciones', async () => {
    const v = P['GUC-CAD'].variants.find((x) => x.code === '60')!;
    const o = (
      await api.post('operaciones', '/api/orders', {
        productId: P['GUC-CAD'].id,
        variantId: v.id,
        workshopId: W.TC,
        targetGrams: 30,
        targetUnits: 1,
        commitmentDate: '2026-11-20',
        notes: 'Cadena 60 cm para cliente',
      })
    ).body;
    const d = (await api.get('operaciones', `/api/orders/${o.id}`)).body;
    expect(d).toMatchObject({
      variantId: v.id,
      targetGrams: 30,
      targetUnits: 1,
      commitmentDate: '2026-11-20',
      notes: 'Cadena 60 cm para cliente',
      workshopId: W.TC,
    });
  });

  it('[RF-027] [RN-017] [VC-14] el aporte de material antes de fabricar conserva origen, ley y operación; los campos son obligatorios', async () => {
    const customer = (await api.get('operaciones', '/api/customers')).body
      .items[0];
    const op = (
      await api.post('operaciones', '/api/customer-operations', {
        customerId: customer.id,
        type: 'CUSTOM_ORDER',
        description: 'Encargo con oro del cliente',
        committedMaterialFineGrams: 7.5,
      })
    ).body;
    const base = {
      customerId: customer.id,
      operationId: op.id,
      materialId: M.AU18.id,
      declaredPurity: 750,
      timing: 'BEFORE_FABRICATION',
      origin: 'Anillo heredado',
      contributionDate: '2026-10-10',
    };
    for (const missing of [
      'declaredPurity',
      'origin',
      'operationId',
      'materialId',
      'timing',
    ]) {
      const body: Record<string, unknown> = {
        ...base,
        weighingId: await weigh(10, 'CUSTOMER_MATERIAL', M.AU18.id),
      };
      delete body[missing];
      expect(
        (await api.post('operaciones', '/api/customer-contributions', body))
          .status,
      ).toBe(400);
    }
    const c = (
      await api.post('operaciones', '/api/customer-contributions', {
        ...base,
        weighingId: await weigh(10, 'CUSTOMER_MATERIAL', M.AU18.id),
      })
    ).body;
    expect(c).toMatchObject({
      timing: 'BEFORE_FABRICATION',
      origin: 'Anillo heredado',
      declaredPurity: 750,
      grams: 10,
      fineGrams: 7.5,
      operationId: op.id,
    });
    const balances = (
      await api.get('operaciones', `/api/customer-operations/${op.id}`)
    ).body.balances;
    expect(balances.material.balanceFineGrams).toBe(0);
    expect(balances.money.paid).toBe(0);
  });

  it('[RN-020] toda transacción exige fecha, concepto y valor y registra al responsable', async () => {
    const cats = (await api.get('finanzas', '/api/finance-categories')).body;
    const base = {
      type: 'EXPENSE',
      categoryId: byCode(cats, 'GASTO_OPERATIVO').id,
      concept: 'Insumos de oficina',
      amount: 50000,
      transactionDate: '2026-10-10',
    };
    for (const missing of ['concept', 'amount', 'transactionDate']) {
      const body: Record<string, unknown> = { ...base };
      delete body[missing];
      expect(
        (await api.post('finanzas', '/api/finance/transactions', body)).status,
      ).toBe(400);
    }
    const t = (
      await api.post('finanzas', '/api/finance/transactions', {
        ...base,
        supportReference: 'FAC-1',
      })
    ).body;
    expect(t.responsibleId).toBe(
      (await api.get('finanzas', '/api/auth/me')).body.id,
    );
    expect(t).toMatchObject({
      concept: 'Insumos de oficina',
      amount: 50000,
      transactionDate: '2026-10-10',
      supportReference: 'FAC-1',
    });
  });

  it('[RF-039] alertas de retraso y de mínimo de inventario', async () => {
    const late = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
        targetGrams: 5,
        commitmentDate: '2026-01-15',
      })
    ).body;
    const cats = (await api.get('admin', '/api/material-categories')).body;
    const units = (await api.get('admin', '/api/units')).body;
    const mat = (
      await api.post('admin', '/api/materials', {
        code: 'MINCHK',
        name: 'Material con mínimo',
        categoryId: byCode(cats, 'METAL_BASE').id,
        baseUnitId: byCode(units, 'g').id,
        minStock: 100,
      })
    ).body;
    await api.post('operaciones', '/api/alerts/run-checks');
    const delays = (
      await api.get('operaciones', '/api/alerts?type=DELAY&pageSize=100')
    ).body.items;
    expect(
      delays.some(
        (a: { entityId: string; severity: string }) =>
          a.entityId === late.id && a.severity === 'CRITICAL',
      ),
    ).toBe(true);
    const mins = (
      await api.get('operaciones', '/api/alerts?type=MIN_STOCK&pageSize=100')
    ).body.items;
    expect(mins.some((a: { entityId: string }) => a.entityId === mat.id)).toBe(
      true,
    );
  });

  it('[RF-036] [RNF-003] la bitácora conserva usuario, fecha, antes/después, aprobaciones y accesos', async () => {
    const mv = (
      await api.get(
        'operaciones',
        `/api/inventory/movements?productionOrderId=${closed.id}&type=CONSUMPTION`,
      )
    ).body.items[0];
    const created = (
      await api.get('auditor', `/api/audit?entityId=${mv.id}&action=CREATE`)
    ).body.items[0];
    expect(created.username).toBe('gerencia');
    expect(created.createdAt).toBeTruthy();
    expect(created.after).toMatchObject({
      type: 'CONSUMPTION',
      reference: closed.number,
    });
    expect(created.after.fromLocationId).toBeTruthy();
    // Origen y destino del movimiento de entrega (Oficina Madre → tránsito/taller).
    const dmv = (
      await api.get(
        'operaciones',
        `/api/inventory/movements?productionOrderId=${closed.id}&type=DISPATCH`,
      )
    ).body.items[0];
    const dlog = (
      await api.get('auditor', `/api/audit?entityId=${dmv.id}&action=CREATE`)
    ).body.items[0];
    expect(dlog.after.fromLocationId).toBeTruthy();
    expect(dlog.after.toLocationId).toBeTruthy();
    expect(dlog.after.fromLocationId).not.toBe(dlog.after.toLocationId);
    expect(dlog.username).toBe('operaciones');
    const customer = (await api.get('operaciones', '/api/customers')).body
      .items[0];
    await api.patch('operaciones', `/api/customers/${customer.id}`, {
      city: 'Pereira',
    });
    const upd = (
      await api.get(
        'auditor',
        `/api/audit?entityId=${customer.id}&action=UPDATE`,
      )
    ).body.items[0];
    expect(upd.after.city).toBe('Pereira');
    expect(upd.before).toHaveProperty('city');
    expect(
      (
        await api.get(
          'auditor',
          `/api/audit?entityId=${closed.id}&action=APPROVE`,
        )
      ).body.total,
    ).toBe(1);
    await api.get('finanzas', '/api/finance/transactions');
    const access = (
      await api.get(
        'auditor',
        '/api/audit?action=ACCESS&entityType=FinancialTransaction',
      )
    ).body.items;
    expect(access[0].username).toBe('finanzas');
  });

  it('[RF-042] la ficha técnica admite fotos del modelo', async () => {
    const det = (
      await api.get('operaciones', `/api/catalog/products/${P['ANI-CL'].id}`)
    ).body;
    const up = await api.upload(
      'operaciones',
      {
        purpose: 'CATALOG',
        productId: P['ANI-CL'].id,
        technicalSheetId: det.currentSheet.id,
        caption: 'Vista frontal',
      },
      await pngFile(),
    );
    expect(up.status).toBe(201);
    const after = (
      await api.get('operaciones', `/api/catalog/products/${P['ANI-CL'].id}`)
    ).body;
    expect(
      after.photos.some(
        (p: { id: string; technicalSheetId: string }) =>
          p.id === up.body.id && p.technicalSheetId === det.currentSheet.id,
      ),
    ).toBe(true);
  });

  it('[RN-024] ocultar una evidencia deja motivo, responsable y bitácora', async () => {
    const m = (
      await api.get('operaciones', `/api/media?productionOrderId=${closed.id}`)
    ).body.items[0];
    const tcHide = await api.post('taller.tc', `/api/media/${m.id}/hide`, {
      reason: 'Quiero quitarla',
    });
    expect(tcHide.status).toBe(422);
    const hid = (
      await api.post('gerencia', `/api/media/${m.id}/hide`, {
        reason: 'Contiene datos del cliente',
      })
    ).body;
    expect(hid).toMatchObject({
      hidden: true,
      hiddenReason: 'Contiene datos del cliente',
    });
    expect(hid.hiddenById).toBe(
      (await api.get('gerencia', '/api/auth/me')).body.id,
    );
    const log = (
      await api.get('auditor', `/api/audit?entityId=${m.id}&action=HIDE`)
    ).body.items[0];
    expect(log.description).toBe('Contiene datos del cliente');
  });

  it('[RN-009] un rol de taller no puede recibir permisos financieros', async () => {
    const res = await api.post('admin', '/api/roles', {
      code: 'TALLER_FIN',
      name: 'Taller con finanzas',
      permissions: ['workshop.portal', 'finance.read'],
      isWorkshopRole: true,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('finance.read');
  });

  it('[RNF-009] se admiten documentos PDF como soporte con trazabilidad', async () => {
    const pdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    );
    const up = await api.upload(
      'operaciones',
      { purpose: 'PURITY_SUPPORT', productionOrderId: closed.id },
      { buffer: pdf, name: 'certificado.pdf', type: 'application/pdf' },
    );
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({
      kind: 'DOCUMENT',
      mimeType: 'application/pdf',
      productionOrderId: closed.id,
    });
    expect(up.body.uploadedById).toBeTruthy();
  });

  it('[SUP-18] [4.2] los supuestos pendientes son parametrizables sin tocar código', async () => {
    // Nombre operativo, protocolo de balanza y tolerancias son parámetros editables.
    expect(
      (
        await api.put('admin', '/api/parameters/company.name', {
          value: 'Prestige Gold S.A.S.',
        })
      ).body.value,
    ).toBe('Prestige Gold S.A.S.');
    const originalScale = (
      await api.get('operaciones', '/api/weighings/config')
    ).body;
    const scale = {
      baudRate: 2400,
      dataBits: 7,
      stopBits: 1,
      parity: 'even',
      model: 'Mettler Toledo MT-SICS',
    };
    expect(
      (await api.put('admin', '/api/parameters/scale.config', { value: scale }))
        .body.value,
    ).toEqual(scale);
    expect(
      (await api.get('operaciones', '/api/weighings/config')).body,
    ).toEqual(scale);
    expect(
      (
        await api.put(
          'admin',
          '/api/parameters/production.defaultLossTolerancePct',
          { value: 1.5 },
        )
      ).body.value,
    ).toBe(1.5);
    expect(
      (
        await api.patch('admin', `/api/products/${P['ANI-CL'].id}`, {
          lossTolerancePct: 2.5,
        })
      ).body.lossTolerancePct,
    ).toBe(2.5);
    // Códigos de taller configurables (no quemados): alta de "Alex/Ales" y corrección posterior del código.
    const ws = (
      await api.post('admin', '/api/workshops', { code: 'ales', name: 'Ales' })
    ).body;
    expect(ws.code).toBe('ALES');
    const renamed = (
      await api.patch('admin', `/api/workshops/${ws.id}`, {
        code: 'alex',
        name: 'Alex',
      })
    ).body;
    expect(renamed).toMatchObject({ code: 'ALEX', name: 'Alex' });
    const loc = (await api.get('admin', '/api/locations')).body.find(
      (l: { workshopId: string }) => l.workshopId === ws.id,
    );
    expect(loc.code).toBe('TALLER-ALEX');
    // Denominaciones comerciales como categorías internas configurables.
    expect(
      (
        await api.post('admin', '/api/product-families', {
          code: 'VANCLEEF',
          name: 'Línea Van Cleef (interna)',
        })
      ).status,
    ).toBe(201);
    // Estructura de mano de obra preparada: tarifas por taller/producto/base.
    const rate = (
      await api.post('admin', '/api/labor-rates', {
        workshopId: ws.id,
        productId: P['ANI-CL'].id,
        basis: 'UNIT',
        rate: 25000,
        validFrom: '2026-10-01',
      })
    ).body;
    expect(rate).toMatchObject({
      basis: 'UNIT',
      rate: 25000,
      workshopId: ws.id,
      productId: P['ANI-CL'].id,
    });
    await api.put('admin', '/api/parameters/company.name', {
      value: 'Prestige Gold',
    });
    await api.put('admin', '/api/parameters/scale.config', {
      value: originalScale,
    });
  });

  it('[RF-031] [CA-010] productividad mensual por taller con gramos, unidades y órdenes cumplidas', async () => {
    const month = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })
      .slice(0, 7);
    const rep = (
      await api.get(
        'gerencia',
        '/api/reports/productivity?from=2026-01-01&to=2026-12-31',
      )
    ).body;
    const row = rep.rows.find(
      (r: { month: string; workshop: string; product: string }) =>
        r.month === month &&
        r.workshop === 'TC · Colmenares' &&
        r.product === 'Anillo clásico 18K',
    );
    expect(row.grams).toBeGreaterThanOrEqual(closed.finished);
    expect(row.units).toBeGreaterThanOrEqual(2);
    expect(row.orders).toBeGreaterThanOrEqual(1);
    const comp = rep.charts.compliance.find(
      (c: { workshop: string }) => c.workshop === 'Colmenares',
    );
    expect(comp.onTime).toBeGreaterThanOrEqual(1);
    // Tiempos y desviaciones por taller, recalculados desde el reporte de cumplimiento.
    const compRep = (
      await api.get(
        'gerencia',
        '/api/reports/compliance?from=2026-01-01&to=2026-12-31',
      )
    ).body;
    const tcRows = compRep.rows.filter(
      (r: { workshop: string; leadTimeDays: number | null }) =>
        r.workshop === 'Colmenares' && r.leadTimeDays !== null,
    );
    const avg =
      tcRows.reduce(
        (a: number, r: { leadTimeDays: number }) => a + r.leadTimeDays,
        0,
      ) / tcRows.length;
    expect(comp.avgLeadDays).toBeCloseTo(Math.round(avg * 10) / 10, 1);
    expect(comp.onTime + comp.late).toBe(tcRows.length);
    expect(comp.late).toBe(
      tcRows.filter((r: { deviationDays: number }) => r.deviationDays > 0)
        .length,
    );
  });

  it('[RF-039b] alertas por consumo anormal frente al estándar', async () => {
    const r = await dispatched(10, 12);
    expect(
      (
        await api.post('taller.tc', `/api/orders/${r.order.id}/consumptions`, {
          items: [{ materialId: M.AU18.id, grams: 11.5 }],
        })
      ).status,
    ).toBe(201);
    const ab = (
      await api.get(
        'operaciones',
        '/api/alerts?type=ABNORMAL_CONSUMPTION&pageSize=100',
      )
    ).body.items;
    const a = ab.find((x: { entityId: string }) => x.entityId === r.order.id);
    expect(a).toMatchObject({ severity: 'WARNING' });
    expect(a.message).toContain('11.5');
  });

  it('[RF-041b] [CA-016] una evidencia subida tarde para una etapa anterior se reordena por fecha de captura y etapa', async () => {
    const r = await dispatched(5);
    const ring = stages.filter(
      (x) =>
        x.families.length === 0 || x.families.some((f) => f.code === 'ANILLOS'),
    );
    const first = ring[0];
    const last = ring[ring.length - 1];
    const png = await pngFile();
    const late = (
      await api.upload(
        'taller.tc',
        { purpose: 'STAGE', productionOrderId: r.order.id, stageId: last.id },
        png,
      )
    ).body;
    const earlier = new Date(Date.now() - 3600_000).toISOString();
    const early = (
      await api.upload(
        'taller.tc',
        {
          purpose: 'STAGE',
          productionOrderId: r.order.id,
          stageId: first.id,
          capturedAt: earlier,
        },
        png,
      )
    ).body;
    const story = (
      await api.get('operaciones', `/api/orders/${r.order.id}/story`)
    ).body;
    expect(story.timeline.map((m: { id: string }) => m.id)).toEqual([
      early.id,
      late.id,
    ]);
    expect(story.groups[0].stage.id).toBe(first.id);
    expect(story.groups[0].items.map((m: { id: string }) => m.id)).toEqual([
      early.id,
    ]);
    expect(
      story.groups
        .find((g: { stage: { id: string } }) => g.stage.id === last.id)
        .items.map((m: { id: string }) => m.id),
    ).toEqual([late.id]);
  });

  it('[RN-022] [RN-021] con calidad aprobada pero ley fuera de tolerancia no se aprueba ni se libera el producto', async () => {
    const r = await produceToReview({ purity: 700 });
    await api.post(
      'operaciones',
      `/api/orders/${r.order.id}/reconciliation/discrepancies`,
    );
    const blocked = await approve(r.order.id);
    expect(blocked.status).toBe(422);
    expect(blocked.body.details.blockers.join(' ')).toMatch(
      /ley 700 fuera de tolerancia/,
    );
    const alerts = (
      await api.get(
        'operaciones',
        '/api/alerts?type=PURITY_NON_CONFORMING&pageSize=100',
      )
    ).body.items;
    expect(
      alerts.find((a: { entityId: string }) => a.entityId === r.order.id),
    ).toMatchObject({ entityType: 'ProductionOrder' });
    const goods = (
      await api.get('operaciones', '/api/finished-goods?pageSize=200')
    ).body.items;
    expect(
      goods.some(
        (g: { orderId: string; status: string }) =>
          g.orderId === r.order.id && g.status === 'AVAILABLE',
      ),
    ).toBe(false);
  });

  it('[4.1] todo material se registra y pesa antes de distribuirse: sin pesaje no hay entrada ni despacho', async () => {
    expect(
      (
        await api.post('operaciones', '/api/inventory/entries', {
          materialId: M.AU18.id,
          origin: 'Sin pesar',
        })
      ).status,
    ).toBe(400);
    const order = (
      await api.post('operaciones', '/api/orders', {
        productId: P['ANI-CL'].id,
        workshopId: W.TC,
        targetGrams: 5,
        commitmentDate: '2026-12-31',
      })
    ).body;
    await api.post('operaciones', `/api/orders/${order.id}/plan`);
    const noW = await api.post('operaciones', '/api/dispatches', {
      orderId: order.id,
      purpose: 'Sin pesar',
      lines: [{ materialId: M.AU18.id }],
    });
    expect(noW.status).toBe(400);
    // Un pesaje con otro propósito tampoco sirve para despachar.
    const entryW = await weigh(1, 'ENTRY', M.AU18.id);
    const wrong = await api.post('operaciones', '/api/dispatches', {
      orderId: order.id,
      purpose: 'Pesaje equivocado',
      lines: [{ materialId: M.AU18.id, weighingId: entryW }],
    });
    expect([400, 422]).toContain(wrong.status);
  });

  it('[RF-025b] la venta registra cliente, operación, producto despachado, valor y responsable', async () => {
    const fg = (
      await api.get('operaciones', '/api/finished-goods?pageSize=200')
    ).body.items.find(
      (g: { orderId: string; status: string }) =>
        g.orderId === closed.id && g.status === 'AVAILABLE',
    );
    expect(fg).toBeTruthy();
    const customer = (await api.get('operaciones', '/api/customers')).body
      .items[0];
    const op = (
      await api.post('operaciones', '/api/customer-operations', {
        customerId: customer.id,
        type: 'SALE',
        description: 'Venta anillo cobertura',
        totalValue: 2500000,
      })
    ).body;
    const sale = await api.post('operaciones', '/api/sales', {
      operationId: op.id,
      dispatchDate: '2026-10-09',
      lines: [{ finishedGoodId: fg.id, units: 1, value: 2500000 }],
    });
    expect(sale.status).toBe(201);
    const me = (await api.get('operaciones', '/api/auth/me')).body.id;
    expect(sale.body).toMatchObject({
      responsibleId: me,
      operationId: op.id,
      customerId: customer.id,
      dispatchDate: '2026-10-09',
    });
    expect(sale.body.lines[0]).toMatchObject({
      finishedGoodId: fg.id,
      units: 1,
      value: 2500000,
    });
    const listed = (
      await api.get('operaciones', '/api/sales?pageSize=100')
    ).body.items.find((x: { id: string }) => x.id === sale.body.id);
    expect(listed.responsibleId).toBe(me);
    Object.assign(sold, {
      opLabel: `${op.number} · ${op.description}`,
      customer: customer.name,
      customerId: customer.id,
      value: 2500000,
    });
  });

  it('[RNF-009b] el PDF de soporte se vuelve a descargar íntegro por URL firmada', async () => {
    const pdf = Buffer.from(
      '%PDF-1.4\n% soporte de ley\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
    );
    const up = (
      await api.upload(
        'operaciones',
        { purpose: 'PURITY_SUPPORT', productionOrderId: closed.id },
        { buffer: pdf, name: 'ley.pdf', type: 'application/pdf' },
      )
    ).body;
    const det = (await api.get('operaciones', `/api/media/${up.id}`)).body;
    const u = new URL(det.urls.original, 'http://x');
    const res = await api.http
      .get(u.pathname + u.search)
      .buffer(true)
      .parse((r, cb) => {
        const c: Buffer[] = [];
        r.on('data', (x: Buffer) => c.push(x));
        r.on('end', () => cb(null, Buffer.concat(c)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(Buffer.compare(res.body as Buffer, pdf)).toBe(0);
  });

  it('[RF-030] [REP-RENT] rentabilidad con ingresos, costos, gastos y utilidad por mes, producto, cliente, taller y operación', async () => {
    const q = 'from=2026-01-01&to=2026-12-31';
    const by = async (g: string) =>
      (
        await api.get(
          'gerencia',
          `/api/reports/profitability?${q}&groupBy=${g}`,
        )
      ).body;
    const month = await by('month');
    expect(month.columns[0].label).toBe('Mes');
    expect(
      month.rows.every((r: { group: string }) => /^\d{4}-\d{2}$/.test(r.group)),
    ).toBe(true);
    const total = month.rows.reduce(
      (s: number, r: { revenue: number }) => s + r.revenue,
      0,
    );
    expect(total).toBe(month.summary.revenue);
    for (const g of ['product', 'customer', 'workshop', 'operation']) {
      const rep = await by(g);
      expect(
        rep.rows.reduce(
          (s: number, r: { revenue: number }) => s + r.revenue,
          0,
        ),
      ).toBe(total);
      for (const r of rep.rows)
        expect(r.grossProfit).toBeCloseTo(r.revenue - r.cogs, 2);
    }
    expect((await by('operation')).columns[0].label).toBe('Operación');
    // Una venta conocida ([RF-025b], 2.500.000) cae en el grupo correcto de operación, cliente y mes.
    const opRow = (await by('operation')).rows.find(
      (r: { group: string }) => r.group === sold.opLabel,
    );
    expect(opRow.revenue).toBe(sold.value);
    expect(opRow.units).toBe(1);
    const allSales = (await api.get('operaciones', '/api/sales?pageSize=200'))
      .body.items as {
      customerId: string;
      dispatchDate: string;
      reversed: boolean;
      lines: { value: number }[];
    }[];
    const live = allSales.filter(
      (x) =>
        !x.reversed &&
        x.dispatchDate >= month.filters.from &&
        x.dispatchDate <= month.filters.to,
    );
    const sum = (xs: typeof live) =>
      xs.flatMap((x) => x.lines).reduce((a, l) => a + l.value, 0);
    const cust = await by('customer');
    expect(
      cust.rows.find((r: { group: string }) => r.group === sold.customer)
        .revenue,
    ).toBe(sum(live.filter((x) => x.customerId === sold.customerId)));
    expect(
      month.rows.find((r: { group: string }) => r.group === '2026-10').revenue,
    ).toBe(sum(live.filter((x) => x.dispatchDate.startsWith('2026-10'))));
    expect(month.summary).toEqual(
      expect.objectContaining({
        revenue: expect.any(Number),
        productionMaterialCost: expect.any(Number),
        productionLaborCost: expect.any(Number),
        operatingExpenses: expect.any(Number),
        consolidatedNet: expect.any(Number),
      }),
    );
    // Utilidad consolidada recalculada desde ventas, costos aprobados y egresos operativos registrados.
    const { from, to } = month.filters as { from: string; to: string };
    const costs = (
      await api.get(
        'finanzas',
        `/api/finance/costs?from=${from}&to=${to}&pageSize=200`,
      )
    ).body.items as { type: string; amount: number }[];
    const material = costs
      .filter((c) => c.type === 'MATERIAL')
      .reduce((a, c) => a + c.amount, 0);
    const labor = costs
      .filter((c) => c.type === 'LABOR')
      .reduce((a, c) => a + c.amount, 0);
    const txs = (
      await api.get(
        'finanzas',
        `/api/finance/transactions?type=EXPENSE&from=${from}&to=${to}&pageSize=200`,
      )
    ).body.items as {
      amount: number;
      status: string;
      source: string;
      category: { isOperatingExpense: boolean };
    }[];
    const opex = txs
      .filter(
        (t) =>
          t.status === 'POSTED' &&
          t.source !== 'REVERSAL' &&
          t.category.isOperatingExpense,
      )
      .reduce((a, t) => a + t.amount, 0);
    expect(month.summary.revenue).toBe(sum(live));
    expect(month.summary.productionMaterialCost).toBeCloseTo(material, 2);
    expect(month.summary.productionLaborCost).toBeCloseTo(labor, 2);
    expect(month.summary.operatingExpenses).toBeCloseTo(opex, 2);
    expect(month.summary.consolidatedNet).toBeCloseTo(
      sum(live) - material - labor - opex,
      2,
    );
  });

  it('[RNF-011] el video se sirve por rangos (reproducción progresiva en celular) con metadatos y asociación a la orden', async () => {
    const vid = (
      await api.get(
        'operaciones',
        `/api/media?productionOrderId=${closed.id}&kind=VIDEO&pageSize=20`,
      )
    ).body.items[0];
    expect(vid).toMatchObject({
      kind: 'VIDEO',
      mimeType: 'video/mp4',
      productionOrderId: closed.id,
    });
    expect(vid.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(vid.sizeBytes).toBeGreaterThan(0);
    expect(vid.capturedAt).toBeTruthy();
    const det = (await api.get('operaciones', `/api/media/${vid.id}`)).body;
    const u = new URL(det.urls.original, 'http://x');
    const full = await api.http
      .get(u.pathname + u.search)
      .buffer(true)
      .parse((r, cb) => {
        const c: Buffer[] = [];
        r.on('data', (x: Buffer) => c.push(x));
        r.on('end', () => cb(null, Buffer.concat(c)));
      });
    expect(full.status).toBe(200);
    expect(full.headers['accept-ranges']).toBe('bytes');
    const part = await api.http
      .get(u.pathname + u.search)
      .set('Range', 'bytes=0-15')
      .buffer(true)
      .parse((r, cb) => {
        const c: Buffer[] = [];
        r.on('data', (x: Buffer) => c.push(x));
        r.on('end', () => cb(null, Buffer.concat(c)));
      });
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(
      `bytes 0-15/${(full.body as Buffer).length}`,
    );
    expect(
      Buffer.compare(
        part.body as Buffer,
        (full.body as Buffer).subarray(0, 16),
      ),
    ).toBe(0);
    // La miniatura/versión web de una foto pesa menos que el original (carga liviana en móvil).
    const photo = (
      await api.get(
        'operaciones',
        `/api/media?productionOrderId=${closed.id}&kind=PHOTO&pageSize=20`,
      )
    ).body.items[0];
    const pd = (await api.get('operaciones', `/api/media/${photo.id}`)).body;
    expect(pd.urls.thumb).toBeTruthy();
  });

  it('[RF-002] [SUP-18] balanza Mettler Toledo MT-SICS: acepta «S S», rechaza movimiento, sobrecarga y errores', async () => {
    const cfg = (await api.get('operaciones', '/api/weighings/config')).body;
    expect(cfg).toMatchObject({
      protocol: 'MT-SICS',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
    });
    const send = (rawReading: string, grossGrams = 12.3456) =>
      api.post('operaciones', '/api/weighings', {
        purpose: 'ENTRY',
        source: 'SCALE',
        grossGrams,
        rawReading,
        deviceInfo: 'Mettler Toledo · Web Serial',
      });
    const ok = await send('S S      12.3456 g');
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      source: 'SCALE',
      grossGrams: 12.3456,
      stable: true,
      rawReading: 'S S      12.3456 g',
    });
    expect((await send('S D      12.3456 g')).body.error).toBe(
      'SCALE_UNSTABLE',
    );
    expect((await send('S S      12.3456 g', 13)).body.error).toBe(
      'SCALE_READING_MISMATCH',
    );
    for (const [raw, status] of [
      ['S +', 'OVERLOAD'],
      ['S -', 'UNDERLOAD'],
      ['S I', 'BUSY'],
      ['ES', 'SYNTAX'],
      ['ET', 'TRANSMISSION'],
      ['EL', 'LOGICAL'],
    ]) {
      const r = await send(raw);
      expect(r.status).toBe(422);
      expect(r.body).toMatchObject({
        error: 'SCALE_ERROR',
        details: { status },
      });
    }
  });

  it('[RNF-011] una carga rechazada no deja archivos temporales y los temporales viejos se limpian solos', async () => {
    const storage = app.get(MediaStorageService);
    const before = await readdir(storage.tmpDir);
    const bad = await api.upload(
      'operaciones',
      { purpose: 'NO_EXISTE' },
      await pngFile(),
    );
    expect(bad.status).toBe(400);
    const noOrder = await api.upload(
      'taller.tc',
      { purpose: 'STAGE' },
      await pngFile(),
    );
    expect(noOrder.status).toBe(400);
    await new Promise((r) => setTimeout(r, 100));
    expect(
      (await readdir(storage.tmpDir)).filter((f) => !before.includes(f)),
    ).toEqual([]);
    const stale = join(storage.tmpDir, 'carga-interrumpida');
    await writeFile(stale, 'x');
    const old = new Date(Date.now() - 2 * 3600_000);
    await utimes(stale, old, old);
    const fresh = join(storage.tmpDir, 'carga-en-curso');
    await writeFile(fresh, 'x');
    expect(await storage.cleanTmp()).toBeGreaterThanOrEqual(1);
    const left = await readdir(storage.tmpDir);
    expect(left).not.toContain('carga-interrumpida');
    expect(left).toContain('carga-en-curso');
  });

  it('[REP-15] cada reporte de la sección 15 entrega su contenido mínimo', async () => {
    const q = 'from=2026-01-01&to=2026-12-31';
    const get = async (k: string, extra = '') =>
      (await api.get('gerencia', `/api/reports/${k}?${q}${extra}`)).body;
    const keys = (r: { columns: { key: string }[] }) =>
      r.columns.map((c) => c.key);

    const inv = await get('inventory-global');
    expect(keys(inv)).toEqual(
      expect.arrayContaining([
        'purity',
        'office',
        'committed',
        'available',
        'workshops',
        'transit',
        'total',
      ]),
    );
    expect(
      inv.rows.find((r: { code: string }) => r.code === 'AU18').total,
    ).toBeGreaterThan(0);

    const k = await get('kardex', `&materialId=${M.AU18.id}`);
    const types = k.rows.map((r: { type: string }) => r.type);
    expect(types).toEqual(
      expect.arrayContaining(['ENTRY', 'CONSUMPTION', 'RETURN']),
    );
    const net = k.rows.reduce(
      (s: number, r: { inGrams: number; outGrams: number }) =>
        s + r.inGrams - r.outGrams,
      0,
    );
    expect(k.summary.closing).toBeCloseTo(k.summary.opening + net, 3);

    const wm = await get('workshop-material', `&workshopId=${W.TC}`);
    expect(keys(wm)).toEqual(
      expect.arrayContaining([
        'workshop',
        'order',
        'material',
        'grams',
        'since',
      ]),
    );
    expect(wm.rows.length).toBeGreaterThan(0);

    const prodRep = await get('productivity');
    expect(keys(prodRep)).toEqual(
      expect.arrayContaining([
        'month',
        'workshop',
        'product',
        'grams',
        'units',
        'orders',
      ]),
    );
    expect(prodRep.summary.totalGrams).toBeCloseTo(
      prodRep.rows.reduce((a: number, r: { grams: number }) => a + r.grams, 0),
      3,
    );

    const ord = await get('orders');
    expect(keys(ord)).toEqual(
      expect.arrayContaining([
        'commitmentDate',
        'progressPct',
        'differencesGrams',
        'overdue',
      ]),
    );
    expect(
      ord.rows.find((r: { number: string }) => r.number === closed.number),
    ).toMatchObject({
      status: 'Aprobada/Cerrada',
      workshop: 'Colmenares',
      product: 'Anillo clásico 18K',
      targetGrams: 10,
      commitmentDate: '2026-12-31',
      overdue: false,
    });
    const ordRow = ord.rows.find(
      (r: { number: string }) => r.number === closed.number,
    );
    expect(ordRow.finishedGrams).toBeCloseTo(closed.finished, 4);
    expect(ordRow.progressPct).toBeCloseTo(
      Math.round((closed.finished / 10) * 1000) / 10,
      1,
    );
    const discs = (
      await api.get(
        'operaciones',
        `/api/discrepancies?orderId=${closed.id}&pageSize=100`,
      )
    ).body.items as { grams: number; status: string }[];
    expect(ordRow.differencesGrams).toBeCloseTo(
      discs
        .filter((d) => d.status !== 'REJECTED')
        .reduce((a, d) => a + d.grams, 0),
      4,
    );
    expect(ordRow.differencesGrams).toBeGreaterThan(0);

    const cvs = await get('consumption-vs-standard');
    expect(
      cvs.rows.find((r: { order: string }) => r.order === closed.number),
    ).toMatchObject({
      material: 'Oro 18K',
      standard: 10.2,
      consumed: closed.consumed,
    });

    const loss = await get('losses');
    const lr = loss.rows.find(
      (r: { order: string; type: string }) =>
        r.order === closed.number && r.type === 'PROCESS_LOSS',
    );
    expect(lr.percent).toBeCloseTo(
      ((closed.consumed - closed.finished) / closed.consumed) * 100,
      2,
    );
    expect(lr).toMatchObject({
      status: 'APPROVED',
      approver: 'Automática (tolerancia)',
    });
    expect(lr.reason).toContain('Merma de proceso');
    expect(lr.workshop).toBe('TC · Colmenares');
    expect(loss.charts.trend.length).toBeGreaterThan(0);
    expect(loss.charts.trend[0]).toEqual({
      month: expect.stringMatching(/^\d{4}-\d{2}$/),
      grams: expect.any(Number),
    });

    const pc = await get('production-costs');
    const pr = pc.rows.find(
      (r: { number: string }) => r.number === closed.number,
    );
    expect(pr.material).toBeCloseTo(closed.consumed * M.AU18.referenceCost, 0);
    expect(pr.labor).toBe(closed.labor);
    expect(pr.costPerGram).toBeCloseTo(
      (pr.material + pr.labor) / closed.finished,
      0,
    );

    const cust = await get('customers');
    expect(keys(cust)).toEqual(
      expect.arrayContaining([
        'sales',
        'paid',
        'moneyBalance',
        'contributedFine',
        'materialBalance',
      ]),
    );
    expect(
      cust.rows.some((r: { contributedFine: number }) => r.contributedFine > 0),
    ).toBe(true);

    const aud = await get('audit');
    expect(keys(aud)).toEqual(
      expect.arrayContaining([
        'createdAt',
        'username',
        'action',
        'entityType',
        'before',
        'after',
      ]),
    );
    expect(
      aud.rows.find(
        (r: { action: string; entityType: string; entityId: string }) =>
          r.action === 'APPROVE' && r.entityId === closed.id,
      ),
    ).toMatchObject({ username: 'gerencia', createdAt: expect.anything() });

    const cat = await get('catalog');
    expect(keys(cat)).toEqual(
      expect.arrayContaining([
        'standardWeight',
        'diameterMm',
        'measures',
        'targetPurity',
        'variables',
      ]),
    );
    const sheet = (
      await api.get('operaciones', `/api/catalog/products/${P['ANI-CL'].id}`)
    ).body.currentSheet;
    const catRow = cat.rows.find((r: { code: string }) => r.code === 'ANI-CL');
    const catDetail = (
      await api.get('operaciones', `/api/catalog/products/${P['ANI-CL'].id}`)
    ).body;
    expect(catRow).toMatchObject({
      version: sheet.versionNumber,
      versions: catDetail.versions.length,
      targetPurity: sheet.targetPurity,
      standardWeight: sheet.standardWeight,
      diameterMm: sheet.diameterMm,
      measures: sheet.measures,
      variables: JSON.stringify(sheet.variables),
    });
    expect(catRow.photos).toBeGreaterThanOrEqual(1);

    const vis = await get('visual-traceability');
    expect(
      vis.rows.find((r: { number: string }) => r.number === closed.number),
    ).toMatchObject({ complete: true });

    const pur = await get('purity-control');
    expect(
      pur.rows.find((r: { order: string }) => r.order === closed.number),
    ).toMatchObject({
      method: 'XRF',
      obtained: 751,
      target: 750,
      conforming: true,
      responsible: 'Cristian Ayala',
      support: 'XRF-COB',
    });

    const comp = await get('compliance');
    const cr = comp.rows.find(
      (r: { number: string }) => r.number === closed.number,
    );
    expect(cr.result).toBe('A tiempo');
    expect(cr.deliveredAt).toBeTruthy();
    expect(cr.deviationDays).toBeLessThanOrEqual(0);
    expect(typeof cr.leadTimeDays).toBe('number');
    expect(comp.summary).toEqual(
      expect.objectContaining({
        avgLeadTimeDays: expect.any(Number),
        avgDeviationDays: expect.any(Number),
      }),
    );

    const prof = await get('profitability');
    expect(prof.summary.productionLaborCost).toBeGreaterThanOrEqual(
      closed.labor,
    );

    // RF-040: también los reportes financieros se exportan a Excel.
    const xlsx = await api.http
      .get(`/api/reports/production-costs/export?format=xlsx&${q}`)
      .set('Authorization', `Bearer ${await api.token('gerencia')}`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
  });
});
