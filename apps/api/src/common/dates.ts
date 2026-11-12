export function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function splitIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m, d];
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = splitIso(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDate(year: number, month: number, day: number): string {
  let y = year;
  let m = month;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return ymd(y, m, Math.min(Math.max(day, 1), lastDay(y, m)));
}

export function todayInKolkata(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function kolkataStart(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00+05:30`);
}

export function periodForMonth(ym: string, startDay: number): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const from = clampDate(y, m, startDay);
  const to = addDays(clampDate(y, m + 1, startDay), -1);
  return { from, to };
}

export function currentPeriodMonth(today: string, startDay: number): string {
  const [y, m, d] = splitIso(today);
  if (d >= startDay) return `${y}-${String(m).padStart(2, '0')}`;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  return clampDate(y, m + delta, 1).slice(0, 7);
}

export function advanceDate(iso: string, frequency: string, anchorMonth: number, anchorDay: number): string {
  const [y, m] = splitIso(iso);
  if (frequency === 'daily') return addDays(iso, 1);
  if (frequency === 'weekly') return addDays(iso, 7);
  if (frequency === 'monthly') return clampDate(y, m + 1, anchorDay);
  return clampDate(y + 1, anchorMonth, anchorDay);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = splitIso(value);
  return clampDate(y, m, d) === value;
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = splitIso(from);
  const [ty, tm, td] = splitIso(to);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
}
