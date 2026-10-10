/**
 * Fechas de negocio en la zona horaria de operación (APP_TIMEZONE, por defecto
 * America/Bogota). Evita que "hasta hoy" o "fecha de hoy" se corran un día por UTC.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Bogota';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local YYYY-MM-DD de un instante en la zona de operación. */
export function localDate(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Desfase (minutos) de la zona de operación respecto a UTC en un instante. */
function offsetMinutes(at: Date): number {
  const local = new Date(
    at.toLocaleString('en-US', { timeZone: APP_TIMEZONE }),
  );
  const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (local.getTime() - utc.getTime()) / 60000;
}

function atLocal(
  date: string,
  h: number,
  m: number,
  s: number,
  ms: number,
): Date {
  const [y, mo, d] = date.slice(0, 10).split('-').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, m, s, ms));
  return new Date(guess.getTime() - offsetMinutes(guess) * 60000);
}

/** Inicio del día local (acepta fecha o fecha-hora ISO; con hora se respeta tal cual). */
export function startOfDay(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? atLocal(value, 0, 0, 0, 0)
    : new Date(value);
}

/** Fin del día local para fechas "YYYY-MM-DD"; con hora se respeta tal cual. */
export function endOfDay(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? atLocal(value, 23, 59, 59, 999)
    : new Date(value);
}

export const localMonth = (d: Date = new Date()) => localDate(d).slice(0, 7);
export const isoDay = (y: number, m: number, d: number) =>
  `${y}-${pad(m)}-${pad(d)}`;
