import { StandardBasis } from '../../../common/enums/domain.enums';
import { roundGrams } from '../../../common/utils/numeric';
import { ConsumptionStandard } from '../../masters/entities/consumption-standard.entity';

export interface ComputedRequirement {
  materialId: string;
  requiredGrams: number;
  tolerancePct: number;
  standardId: string;
}

/**
 * RF-008: insumos requeridos según estándar. Un estándar de variante reemplaza al
 * general del mismo material. Ej. Escenario C: 0.28 g hilo/g × 250 g = 70 g.
 */
export function computeRequirements(
  standards: ConsumptionStandard[],
  target: { grams: number; units: number | null; variantId: string | null },
): ComputedRequirement[] {
  const active = standards.filter((s) => s.active);
  const byMaterial = new Map<string, ConsumptionStandard>();
  for (const s of active.filter((x) => !x.variantId)) byMaterial.set(s.materialId, s);
  if (target.variantId) {
    for (const s of active.filter((x) => x.variantId === target.variantId)) byMaterial.set(s.materialId, s);
  }
  const out: ComputedRequirement[] = [];
  for (const s of byMaterial.values()) {
    let qty = 0;
    switch (s.basis) {
      case StandardBasis.PER_GRAM:
        qty = s.quantity * target.grams;
        break;
      case StandardBasis.PER_UNIT:
        qty = s.quantity * (target.units ?? 0);
        break;
      case StandardBasis.PER_LOT:
        qty = Math.ceil(target.grams / (s.lotSizeGrams || target.grams || 1)) * s.quantity;
        break;
    }
    if (qty > 0) out.push({ materialId: s.materialId, requiredGrams: roundGrams(qty), tolerancePct: s.tolerancePct, standardId: s.id });
  }
  return out;
}
