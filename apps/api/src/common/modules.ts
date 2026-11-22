import { fail } from './money';
import { isStaff } from './roles';

export const MODULES = ['transactions', 'investments', 'budgets', 'goals', 'recurring', 'reports'] as const;

export type AppModuleName = (typeof MODULES)[number];

export function allModules(): AppModuleName[] {
  return [...MODULES];
}

export function userModules(user: { role: string; modules?: string[] | null }): AppModuleName[] {
  if (isStaff(user.role)) return allModules();
  const granted = new Set(user.modules ?? []);
  return MODULES.filter((name) => granted.has(name));
}

export function normalizeModules(value: unknown, role: string): AppModuleName[] {
  if (isStaff(role)) return allModules();
  const raw = Array.isArray(value) ? value.map((item) => String(item)) : [];
  const picked = MODULES.filter((name) => raw.includes(name));
  if (picked.length === 0) fail('Enable at least one module');
  return picked;
}

export function moduleForPath(path: string): AppModuleName | null {
  const clean = path.split('?')[0];
  if (/\/api\/(accounts|categories|transactions|dashboard)(\/|$)/.test(clean)) return 'transactions';
  if (/\/api\/holdings(\/|$)/.test(clean)) return 'investments';
  if (/\/api\/budgets(\/|$)/.test(clean)) return 'budgets';
  if (/\/api\/goals(\/|$)/.test(clean)) return 'goals';
  if (/\/api\/recurring(\/|$)/.test(clean)) return 'recurring';
  if (/\/api\/reports(\/|$)/.test(clean)) return 'reports';
  return null;
}
