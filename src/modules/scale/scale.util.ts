/**
 * Extrae el peso (en gramos) de la trama de una balanza. Soporta los formatos más
 * comunes de balanzas de joyería por puerto serie (Ohaus, A&D, Sartorius, Radwag,
 * Kern y Mettler Toledo MT-SICS "S S/S D"), incluidas unidades de joyería (ct, dwt, gn, ozt):
 *   "ST,GS,+  1000.25 g", "+0001000.25 g", "N    +1000.250 g", "US,NT,  12.5 kg".
 * La marca/protocolo definitivo se confirmará (sección 18); por eso es tolerante.
 */
export function parseScaleReading(
  raw: string,
): { grams: number; stable: boolean } | null {
  const text = raw.trim();
  const match = text.match(
    /([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|gn|g|ct|ozt|oz|dwt)?/i,
  );
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const value = Number(match[2].replace(',', '.')) * sign;
  const unit = (match[3] ?? 'g').toLowerCase();
  const factor: Record<string, number> = {
    g: 1,
    kg: 1000,
    ct: 0.2,
    ozt: 31.1034768,
    oz: 28.3495231,
    dwt: 1.55517384,
    gn: 0.06479891,
  };
  const grams = value * (factor[unit] ?? 1);
  // "US" (unstable) o "?" marcan lectura inestable en la mayoría de protocolos.
  const stable = !/(^|[,\s])US([,\s]|$)|^S\s+D\s|\?/i.test(text);
  return { grams, stable };
}

/** Respuestas de estado/error del protocolo Mettler Toledo MT-SICS (sin peso utilizable). */
export const MT_SICS_ERRORS: Record<string, string> = {
  OVERLOAD: 'Balanza en sobrecarga (S +): retire peso',
  UNDERLOAD: 'Balanza bajo el rango (S -): verifique el plato y haga cero',
  BUSY: 'Balanza ocupada (S I): espere y vuelva a leer',
  SYNTAX: 'La balanza no reconoció el comando (ES)',
  TRANSMISSION:
    'Error de transmisión con la balanza (ET): revise cable y baudios',
  LOGICAL: 'La balanza no puede ejecutar el comando (EL)',
};

/** Clasifica una respuesta MT-SICS de estado/error; null si la trama trae un peso. */
export function mtSicsError(raw: string): keyof typeof MT_SICS_ERRORS | null {
  const t = raw.trim().toUpperCase();
  if (/^S\s+\+$/.test(t)) return 'OVERLOAD';
  if (/^S\s+-$/.test(t)) return 'UNDERLOAD';
  if (/^S\s+I$/.test(t)) return 'BUSY';
  if (t === 'ES') return 'SYNTAX';
  if (t === 'ET') return 'TRANSMISSION';
  if (t === 'EL') return 'LOGICAL';
  return null;
}
