import type { ValueTransformer } from 'typeorm';

/**
 * PostgreSQL devuelve NUMERIC como string. Este transformer lo expone como number
 * (gramos con 4 decimales y dinero con 2 caben con holgura en un double).
 */
export const numeric: ValueTransformer = {
  to: (v?: number | null) => (v === undefined || v === null ? v : v),
  from: (v?: string | null) => (v === undefined || v === null ? v : Number(v)),
};

/** Columna de gramos: 14 dígitos, 4 decimales (precisión de balanza analítica). */
export const gramsColumn = {
  type: 'numeric' as const,
  precision: 14,
  scale: 4,
  transformer: numeric,
};

/** Columna de dinero: 16 dígitos, 2 decimales. */
export const moneyColumn = {
  type: 'numeric' as const,
  precision: 16,
  scale: 2,
  transformer: numeric,
};

/** Ley/pureza en milésimas (999.9 = oro fino) o porcentajes. */
export const purityColumn = {
  type: 'numeric' as const,
  precision: 7,
  scale: 3,
  transformer: numeric,
};

/** Redondeo seguro a N decimales evitando errores de coma flotante acumulados. */
export function round(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export const roundGrams = (v: number) => round(v, 4);
export const roundMoney = (v: number) => round(v, 2);

/** Umbral bajo el cual una diferencia en gramos se considera cero (ruido). */
export const GRAM_EPSILON = 0.001;
