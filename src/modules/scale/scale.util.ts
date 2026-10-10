/**
 * Extrae el peso (en gramos) de la trama de una balanza. Soporta los formatos más
 * comunes de balanzas de joyería por puerto serie (Ohaus, A&D, Sartorius, Radwag):
 *   "ST,GS,+  1000.25 g", "+0001000.25 g", "N    +1000.250 g", "US,NT,  12.5 kg".
 * La marca/protocolo definitivo se confirmará (sección 18); por eso es tolerante.
 */
export function parseScaleReading(raw: string): { grams: number; stable: boolean } | null {
  const text = raw.trim();
  const match = text.match(/([+-]?)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ct|ozt|oz)?/i);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const value = Number(match[2].replace(',', '.')) * sign;
  const unit = (match[3] ?? 'g').toLowerCase();
  const factor: Record<string, number> = { g: 1, kg: 1000, ct: 0.2, ozt: 31.1034768, oz: 28.3495231 };
  const grams = value * (factor[unit] ?? 1);
  // "US" (unstable) o "?" marcan lectura inestable en la mayoría de protocolos.
  const stable = !/(^|[,\s])US([,\s]|$)|\?/i.test(text);
  return { grams, stable };
}
