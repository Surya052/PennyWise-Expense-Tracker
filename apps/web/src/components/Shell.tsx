import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { canUse, type ModuleId } from '../lib/modules'
import { APP_VERSION, isStaff } from '../lib/version'

const nav: { to: string; label: string; icon?: string; fab?: boolean; module?: ModuleId }[] = [
  { to: '/', label: 'Home', icon: '⌂', module: 'transactions' },
  { to: '/transactions', label: 'Transactions', icon: '≡', module: 'transactions' },
  { to: '/add', label: 'Add', fab: true, module: 'transactions' },
  { to: '/investments', label: 'Investments', icon: '◔', module: 'investments' },
  { to: '/more', label: 'More', icon: '⋯' },
]

const sidebar: { to: string; label: string; module?: ModuleId }[] = [
  { to: '/', label: 'Dashboard', module: 'transactions' },
  { to: '/transactions', label: 'Transactions', module: 'transactions' },
  { to: '/investments', label: 'Investments', module: 'investments' },
  { to: '/accounts', label: 'Accounts', module: 'transactions' },
  { to: '/categories', label: 'Categories', module: 'transactions' },
  { to: '/budgets', label: 'Budgets', module: 'budgets' },
  { to: '/goals', label: 'Goals', module: 'goals' },
  { to: '/recurring', label: 'Recurring', module: 'recurring' },
  { to: '/reports', label: 'Reports', module: 'reports' },
  { to: '/settings', label: 'Settings' },
  { to: '/more', label: 'More' },
]

function linkClass(active: boolean) {
  return active
    ? 'text-[var(--primary)] font-medium'
    : 'text-[var(--muted)] hover:text-[var(--text)]'
}

export function Shell() {
  const location = useLocation()
  const { user } = useAuth()
  const hideNav = location.pathname === '/add'
  const allowed = (module?: ModuleId) => !module || canUse(user?.modules, module, user?.role)
  const mobileNav = nav.filter((item) => allowed(item.module))
  const desktopNav = [
    ...sidebar.filter((item) => allowed(item.module)),
    ...(isStaff(user?.role) ? [{ to: '/admin', label: 'Admin' }] : []),
    { to: '/requests', label: isStaff(user?.role) ? 'Requests' : 'My requests' },
  ]

  return (
    <div className="flex min-h-dvh bg-[var(--bg)]">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] p-4 md:flex">
        <div className="mb-4 shrink-0 px-2">
          <p className="text-lg font-semibold text-[var(--text)]">PennyWise</p>
          <p className="text-sm text-[var(--muted)]">Every rupee, calmly</p>
          <p className="text-xs text-[var(--muted)]">Version {APP_VERSION}</p>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
          {desktopNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }: { isActive: boolean }) =>
                `min-h-11 shrink-0 rounded-xl px-3 py-2 text-sm transition ${linkClass(isActive)}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {allowed('transactions') ? (
          <NavLink
            to="/add"
            className="mt-3 flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--btn)] text-sm font-semibold text-[var(--surface)]"
          >
            Add transaction
          </NavLink>
        ) : null}
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main className={`mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4 safe-top md:pb-8 md:pt-8 ${hideNav ? 'pb-8' : ''}`}>
          <Outlet />
        </main>
        {!hideNav ? (
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden safe-bottom"
            aria-label="Main"
          >
            <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pt-1">
              {mobileNav.map((item) =>
                item.fab ? (
                  <li key={item.to} className="flex flex-1 justify-center">
                    <NavLink
                      to={item.to}
                      className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--btn)] text-2xl font-light text-[var(--surface)] shadow-lg"
                      aria-label="Add transaction"
                    >
                      +
                    </NavLink>
                  </li>
                ) : (
                  <li key={item.to} className="flex flex-1">
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={({ isActive }: { isActive: boolean }) =>
                        `flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight ${linkClass(isActive)}`
                      }
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="max-w-full truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ),
              )}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  )
}
