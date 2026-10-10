import { StandardBasis } from '../../../common/enums/domain.enums';
import { ConsumptionStandard } from '../../masters/entities/consumption-standard.entity';
import { computeRequirements } from './requirements.util';

const std = (p: Partial<ConsumptionStandard>): ConsumptionStandard =>
  ({
    id: Math.random().toString(),
    active: true,
    variantId: null,
    tolerancePct: 5,
    lotSizeGrams: null,
    ...p,
  }) as ConsumptionStandard;

describe('computeRequirements (RF-008)', () => {
  it('Escenario C: 250 g × 0.28 g/g de hilo = 70 g', () => {
    const r = computeRequirements(
      [
        std({
          materialId: 'hilo',
          basis: StandardBasis.PER_GRAM,
          quantity: 0.28,
        }),
      ],
      { grams: 250, units: null, variantId: null },
    );
    expect(r).toEqual([
      expect.objectContaining({ materialId: 'hilo', requiredGrams: 70 }),
    ]);
  });

  it('por unidad y por lote', () => {
    const r = computeRequirements(
      [
        std({ materialId: 'a', basis: StandardBasis.PER_UNIT, quantity: 2.5 }),
        std({
          materialId: 'b',
          basis: StandardBasis.PER_LOT,
          quantity: 3,
          lotSizeGrams: 100,
        }),
      ],
      { grams: 250, units: 4, variantId: null },
    );
    expect(r.find((x) => x.materialId === 'a')!.requiredGrams).toBe(10);
    expect(r.find((x) => x.materialId === 'b')!.requiredGrams).toBe(9);
  });

  it('el estándar de la variante reemplaza al general y se ignoran inactivos', () => {
    const r = computeRequirements(
      [
        std({ materialId: 'au', basis: StandardBasis.PER_GRAM, quantity: 1 }),
        std({
          materialId: 'au',
          basis: StandardBasis.PER_GRAM,
          quantity: 1.2,
          variantId: 'v1',
        }),
        std({
          materialId: 'x',
          basis: StandardBasis.PER_GRAM,
          quantity: 1,
          active: false,
        }),
      ],
      { grams: 10, units: null, variantId: 'v1' },
    );
    expect(r).toHaveLength(1);
    expect(r[0].requiredGrams).toBe(12);
  });
});
