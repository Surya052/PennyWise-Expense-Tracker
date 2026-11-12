import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Card } from '../components/Card'
import { apiFetch } from '../lib/api'

const links = [
  { to: '/settings', label: 'Settings', desc: 'Profile, theme, export' },
  { to: '/accounts', label: 'Accounts', desc: 'Cash, bank, cards' },
  { to: '/categories', label: 'Categories', desc: 'Organise spending' },
  { to: '/budgets', label: 'Budgets', desc: 'Monthly limits' },
  { to: '/goals', label: 'Goals', desc: 'Savings targets' },
  { to: '/recurring', label: 'Recurring', desc: 'Rent, salary, SIP' },
  { to: '/reports', label: 'Reports', desc: 'CSV, PDF, import' },
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
        {links.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow)]">
              <p className="font-medium text-[var(--text)]">{item.label}</p>
              <p className="text-sm text-[var(--muted)]">{item.desc}</p>
            </Link>
          </li>
        ))}
        {user?.role === 'admin' ? (
          <li>
            <Link to="/admin" className="block rounded-[18px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="font-medium text-[var(--text)]">Admin</p>
              <p className="text-sm text-[var(--muted)]">Users and audit</p>
            </Link>
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        className="min-h-11 rounded-2xl border border-[var(--border)] text-sm text-[var(--muted)]"
        onClick={() => void apiFetch('/auth/logout', { method: 'POST' }).then(() => window.location.assign('/login'))}
      >
        Sign out
      </button>
    </div>
  )
}
