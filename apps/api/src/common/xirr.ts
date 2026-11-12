export type CashFlow = { date: string; amountPaise: bigint };

export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const ordered = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  if (!ordered.some((f) => f.amountPaise > 0n) || !ordered.some((f) => f.amountPaise < 0n)) return null;
  const t0 = Date.parse(`${ordered[0].date}T00:00:00Z`);
  const years = ordered.map((f) => (Date.parse(`${f.date}T00:00:00Z`) - t0) / 86400000 / 365);
  const amounts = ordered.map((f) => Number(f.amountPaise) / 100);
  let rate = 0.1;
  for (let i = 0; i < 80; i++) {
    let npv = 0;
    let derivative = 0;
    for (let j = 0; j < amounts.length; j++) {
      const den = Math.pow(1 + rate, years[j]);
      npv += amounts[j] / den;
      derivative -= (years[j] * amounts[j]) / (den * (1 + rate));
    }
    if (!Number.isFinite(npv) || !Number.isFinite(derivative) || derivative === 0) return null;
    const next = rate - npv / derivative;
    if (Math.abs(next - rate) < 1e-8) return next;
    rate = next <= -0.999999 ? -0.5 : next;
  }
  return Number.isFinite(rate) ? rate : null;
}

export function cagr(startPaise: bigint, endPaise: bigint, days: number): number | null {
  if (startPaise <= 0n || endPaise < 0n || days <= 0) return null;
  const years = days / 365;
  if (years <= 0) return null;
  const ratio = Number(endPaise) / Number(startPaise);
  if (!Number.isFinite(ratio) || ratio < 0) return null;
  return Math.pow(ratio, 1 / years) - 1;
}
