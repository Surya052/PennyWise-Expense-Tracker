import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { canUse, type ModuleId } from '../lib/modules'
import { APP_VERSION, isStaff } from '../lib/version'
import { Card } from '../components/Card'
import { apiFetch } from '../lib/api'

const links: { to: string; label: string; desc: string; module?: ModuleId }[] = [
  { to: '/settings', label: 'Settings', desc: 'Profile, theme, export' },
  { to: '/accounts', label: 'Accounts', desc: 'Cash, bank, cards', module: 'transactions' },
  { to: '/categories', label: 'Categories', desc: 'Organise spending', module: 'transactions' },
  { to: '/budgets', label: 'Budgets', desc: 'Monthly limits', module: 'budgets' },
  { to: '/goals', label: 'Goals', desc: 'Savings targets', module: 'goals' },
  { to: '/recurring', label: 'Recurring', desc: 'Rent, salary, SIP', module: 'recurring' },
  { to: '/reports', label: 'Reports', desc: 'Excel, CSV, PDF, import', module: 'reports' },
]

export function More() {
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">More</h1>
      <Card>
        <p className="text-sm text-[var(--muted)]">Signed in as</p>
        <p className="font-medium text-[var(--text)]">{user?.name}</p>
        <p className="text-sm text-[var(--muted)]">{user?.email}</p>
      </Card>
      <ul className="flex flex-col gap-2">
        {links.filter((item) => !item.module || canUse(user?.modules, item.module, user?.role)).map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow)]">
              <p className="font-medium text-[var(--text)]">{item.label}</p>
              <p className="text-sm text-[var(--muted)]">{item.desc}</p>
            </Link>
          </li>
        ))}
        {isStaff(user?.role) ? (
          <li>
            <Link to="/admin" className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="font-medium text-[var(--text)]">Admin</p>
              <p className="text-sm text-[var(--muted)]">Users, their records, and approvals</p>
            </Link>
          </li>
        ) : null}
        <li>
          <Link to="/requests" className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="font-medium text-[var(--text)]">{isStaff(user?.role) ? 'Requests' : 'My requests'}</p>
            <p className="text-sm text-[var(--muted)]">{isStaff(user?.role) ? 'Approve edits and deletes' : 'Changes waiting for an admin'}</p>
          </Link>
        </li>
      </ul>
      <button
        type="button"
        className="min-h-11 rounded-2xl border border-[var(--border)] text-sm text-[var(--muted)]"
        onClick={() => void apiFetch('/auth/logout', { method: 'POST' }).then(() => window.location.assign('/login'))}
      >
        Sign out
      </button>
      <p className="text-center text-xs text-[var(--muted)]">Version {APP_VERSION}</p>
    </div>
  )
}
