/** Campos que jamás deben quedar en la bitácora. */
const SENSITIVE = new Set([
  'passwordHash',
  'password',
  'tokenHash',
  'signatureImage',
  'refreshToken',
]);

/** Convierte una entidad a JSON plano, sin secretos ni relaciones cargadas pesadas. */
export function sanitizeForAudit(
  value: unknown,
): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') return { value };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE.has(k)) continue;
    if (v instanceof Date) out[k] = v.toISOString();
    else if (Array.isArray(v)) {
      // Arrays de primitivos (permisos, opciones) sí; colecciones de entidades no.
      if (v.every((x) => typeof x !== 'object' || x === null)) out[k] = v;
    } else if (v !== null && typeof v === 'object') {
      // Relación cargada: guardamos solo su id/código como referencia.
      const rel = v as Record<string, unknown>;
      if ('id' in rel) out[`${k}Ref`] = rel.code ?? rel.number ?? rel.id;
      else out[k] = v; // jsonb (variables, checklist…)
    } else out[k] = v;
  }
  return out;
}
