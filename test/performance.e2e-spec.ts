import { INestApplication } from '@nestjs/common';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Api, byCode, createApp } from './helpers';

/**
 * RNF-007 · Rendimiento bajo volumen. Se genera por la API real (mismas validaciones,
 * transacciones y bloqueos que en operación) un volumen de referencia equivalente a
 * meses de operación de 4 talleres, con capturas concurrentes, y se mide la latencia
 * p95 de las consultas operativas y de las capturas de movimientos.
 *
 * Umbrales (parametrizables): consultas p95 ≤ 1000 ms, capturas p95 ≤ 1500 ms.
 */
const ENTRIES = Number(process.env.PERF_ENTRIES ?? 1500);
const ORDERS = Number(process.env.PERF_ORDERS ?? 300);
const CONCURRENCY = Number(process.env.PERF_CONCURRENCY ?? 10);
const QUERY_P95_MS = Number(process.env.PERF_QUERY_P95_MS ?? 1000);
const CAPTURE_P95_MS = Number(process.env.PERF_CAPTURE_P95_MS ?? 1500);

const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.95) - 1)];

async function pool<T>(
  n: number,
  worker: (i: number) => Promise<T>,
): Promise<T[]> {
  const out: T[] = new Array<T>(n);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < n) {
        const i = next++;
        out[i] = await worker(i);
      }
    }),
  );
  return out;
}

describe('Prestige Gold · rendimiento bajo volumen (e2e)', () => {
  let app: INestApplication;
  let api: Api;

  const prevLimit = process.env.THROTTLE_LIMIT;
  beforeAll(async () => {
    // Varios usuarios simultáneos: el límite global por IP no es objeto de esta medición
    // (el rate limiting se prueba en la suite de seguridad).
    process.env.THROTTLE_LIMIT = '1000000';
    app = await createApp();
    api = new Api(app);
  });

  afterAll(async () => {
    process.env.THROTTLE_LIMIT = prevLimit;
    await app.close();
  });

  it(`[RNF-007] ${ENTRIES} capturas concurrentes y consultas operativas con p95 dentro del umbral`, async () => {
    const cats = (await api.get('admin', '/api/material-categories')).body;
    const units = (await api.get('admin', '/api/units')).body;
    const mat = (
      await api.post('admin', '/api/materials', {
        code: 'PERF',
        name: 'Material de prueba de carga',
        categoryId: byCode(cats, 'METAL_BASE').id,
        baseUnitId: byCode(units, 'g').id,
      })
    ).body;
    expect(mat.id).toBeTruthy();
    const product = byCode(
      (await api.get('admin', '/api/products?pageSize=50')).body.items,
      'ANI-CL',
    );
    const tca = byCode(
      (await api.get('admin', '/api/workshops?pageSize=50')).body.items,
      'TC',
    );

    // 1) Capturas de movimientos concurrentes: pesaje en Balanza Madre + entrada al kardex.
    await api.token('operaciones');
    const captures = await pool(ENTRIES, async (i) => {
      const t0 = performance.now();
      const w = await api.post('operaciones', '/api/weighings', {
        purpose: 'ENTRY',
        source: 'MANUAL',
        grossGrams: 1 + (i % 50) / 10,
        materialId: mat.id,
        manualReason: 'Carga de volumen',
      });
      const e = await api.post('operaciones', '/api/inventory/entries', {
        materialId: mat.id,
        weighingId: w.body.id,
        origin: `Carga ${i}`,
        reference: `PERF-${i}`,
      });
      if (w.status !== 201 || e.status !== 201)
        throw new Error(
          `captura ${i}: ${w.status} ${JSON.stringify(w.body)} / ${e.status} ${JSON.stringify(e.body)}`,
        );
      return performance.now() - t0;
    });

    // 2) Órdenes de producción planificadas en volumen.
    await pool(ORDERS, async (i) => {
      const r = await api.post('operaciones', '/api/orders', {
        productId: product.id,
        workshopId: tca.id,
        targetGrams: 5 + (i % 20),
        commitmentDate: '2026-12-31',
        notes: `Volumen ${i}`,
      });
      if (r.status !== 201)
        throw new Error(`orden ${i}: ${r.status} ${JSON.stringify(r.body)}`);
    });

    // Integridad tras la concurrencia: el saldo del material es exactamente la suma de lo capturado.
    const expected = Array.from(
      { length: ENTRIES },
      (_, i) => 1 + (i % 50) / 10,
    ).reduce((a, b) => a + b, 0);
    const kardex = (
      await api.get(
        'gerencia',
        `/api/reports/kardex?materialId=${mat.id}&from=2026-01-01&to=2027-12-31`,
      )
    ).body;
    expect(kardex.rows.length).toBe(ENTRIES);
    expect(kardex.summary.closing).toBeCloseTo(expected, 3);

    // 3) Consultas operativas sobre el volumen (10 repeticiones concurrentes cada una).
    const queries: [string, string][] = [
      ['operaciones', '/api/inventory/summary'],
      [
        'operaciones',
        `/api/inventory/movements?materialId=${mat.id}&pageSize=50`,
      ],
      ['operaciones', '/api/inventory/movements?pageSize=50&search=PERF-1499'],
      ['operaciones', '/api/orders?pageSize=50'],
      ['operaciones', `/api/orders?workshopId=${tca.id}&pageSize=50`],
      ['gerencia', '/api/dashboard/office'],
      ['taller.tc', '/api/workshop-portal/dashboard'],
      ['operaciones', '/api/alerts?pageSize=50'],
      ['gerencia', '/api/reports/inventory-global'],
      [
        'gerencia',
        `/api/reports/kardex?materialId=${mat.id}&from=2026-01-01&to=2027-12-31`,
      ],
      ['gerencia', '/api/reports/orders?from=2026-01-01&to=2027-12-31'],
    ];
    for (const [u] of queries) await api.token(u);
    const results: Record<string, { p95: number; max: number; n: number }> = {};
    for (const [user, url] of queries) {
      const times = await pool(10, async () => {
        const t0 = performance.now();
        const r = await api.get(user, url);
        expect(r.status).toBe(200);
        return performance.now() - t0;
      });
      results[url] = {
        p95: Math.round(p95(times)),
        max: Math.round(Math.max(...times)),
        n: times.length,
      };
    }

    const report = {
      volume: {
        entries: ENTRIES,
        movements: ENTRIES,
        weighings: ENTRIES,
        orders: ORDERS,
        concurrency: CONCURRENCY,
      },
      thresholds: { queryP95Ms: QUERY_P95_MS, captureP95Ms: CAPTURE_P95_MS },
      captures: {
        p95: Math.round(p95(captures)),
        max: Math.round(Math.max(...captures)),
        n: captures.length,
      },
      queries: results,
    };
    const dir = join(__dirname, '..', '..', 'docs', 'verificacion');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'rendimiento.json'),
      JSON.stringify(report, null, 2),
    );
    console.table({
      'captura (pesaje + entrada)': report.captures,
      ...results,
    });

    expect(report.captures.p95).toBeLessThanOrEqual(CAPTURE_P95_MS);
    for (const [url, r] of Object.entries(results)) {
      if (r.p95 > QUERY_P95_MS)
        throw new Error(`${url}: p95 ${r.p95} ms > ${QUERY_P95_MS} ms`);
    }
  }, 600_000);
});
