export const MODULES = [
  { id: 'transactions', label: 'Transactions', hint: 'Home, accounts, categories, and adding entries' },
  { id: 'investments', label: 'Investments', hint: 'Holdings and value updates' },
  { id: 'budgets', label: 'Budgets', hint: 'Monthly spending limits' },
  { id: 'goals', label: 'Goals', hint: 'Savings targets' },
  { id: 'recurring', label: 'Recurring', hint: 'Repeating income and expenses' },
  { id: 'reports', label: 'Reports', hint: 'Excel, CSV, PDF, and import' },
] as const

export type ModuleId = (typeof MODULES)[number]['id']

const PATHS: Record<ModuleId, string[]> = {
  transactions: ['/', '/transactions', '/add', '/accounts', '/categories'],
  investments: ['/investments'],
  budgets: ['/budgets'],
  goals: ['/goals'],
  recurring: ['/recurring'],
  reports: ['/reports'],
}

export function canUse(modules: string[] | undefined, id: ModuleId, role?: string) {
  if (role === 'admin') return true
  return (modules ?? []).includes(id)
}

export function moduleForPath(pathname: string): ModuleId | null {
  if (pathname === '/') return 'transactions'
  for (const [id, paths] of Object.entries(PATHS) as [ModuleId, string[]][]) {
    if (id === 'transactions') {
      if (paths.some((path) => path !== '/' && (pathname === path || pathname.startsWith(`${path}/`)))) return id
      continue
    }
    if (paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return id
  }
  return null
}

export function firstAllowedPath(modules: string[] | undefined, role?: string) {
  const match = MODULES.find((item) => canUse(modules, item.id, role))
  if (!match) return '/settings'
  if (match.id === 'transactions') return '/'
  return PATHS[match.id][0]
}
