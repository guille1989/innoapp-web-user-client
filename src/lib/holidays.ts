/**
 * Festivos de Colombia (Ley Emiliani, Ley 51 de 1983). Se calculan por año: no
 * hay lista que mantener. Las claves son días "YYYY-MM-DD" (UTC, como el resto
 * de las fechas de las gráficas).
 */

const cache = new Map<number, Set<string>>();

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function key(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function plusDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Si el día no cae en lunes, el festivo se traslada al lunes siguiente. */
function nextMonday(date: Date): Date {
  const weekday = date.getUTCDay(); // 0 = domingo
  return weekday === 1 ? date : plusDays(date, (8 - weekday) % 7);
}

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

function holidaysOf(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;
  const pascua = easter(year);
  const days = [
    // Fijos
    utc(year, 1, 1), utc(year, 5, 1), utc(year, 7, 20), utc(year, 8, 7), utc(year, 12, 8), utc(year, 12, 25),
    // Jueves y Viernes Santo
    plusDays(pascua, -3), plusDays(pascua, -2),
    // Trasladados al lunes siguiente
    nextMonday(utc(year, 1, 6)), nextMonday(utc(year, 3, 19)), nextMonday(utc(year, 6, 29)),
    nextMonday(utc(year, 8, 15)), nextMonday(utc(year, 10, 12)), nextMonday(utc(year, 11, 1)),
    nextMonday(utc(year, 11, 11)),
    // Ascensión, Corpus Christi y Sagrado Corazón (Pascua + 39, 60 y 68 días, trasladados al lunes)
    nextMonday(plusDays(pascua, 39)), nextMonday(plusDays(pascua, 60)), nextMonday(plusDays(pascua, 68)),
  ];
  const set = new Set(days.map(key));
  cache.set(year, set);
  return set;
}

export function isHoliday(dayKey: string): boolean {
  return holidaysOf(Number(dayKey.slice(0, 4))).has(dayKey);
}
