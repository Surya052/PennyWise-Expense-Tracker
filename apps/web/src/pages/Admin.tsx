import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { Card } from '../components/Card'
import { Skeleton } from '../components/Skeleton'

type Stats = { total: number; active: number; newThisMonth: number }

type AdminUser = {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  transactionCount: number
  accountCount: number
}

type Audit = {
  id: string
  action: string
  adminName: string | null
  ip: string
  createdAt: string
  meta: Record<string, unknown>
}

export function Admin() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [error, setError] = useState('')

  if (user?.role !== 'admin') return <Navigate to="/" replace />

  function load() {
    setLoading(true)
    void Promise.all([
      apiFetch<Stats>('/admin/stats'),
      apiFetch<AdminUser[]>(`/admin/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`),
      apiFetch<Audit[]>('/admin/audit'),
    ])
      .then(([s, u, a]) => {
        setStats(s)
        setUsers(u)
        setAudit(a)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (user?.role !== 'admin') return
    load()
  }, [q, user?.role])

  async function createUser(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      })
      setName('')
      setEmail('')
      setPassword('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed')
    }
  }

  async function toggleActive(row: AdminUser) {
    await apiFetch(`/admin/users/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !row.isActive }),
    })
    load()
  }

  async function removeUser(id: string) {
    await apiFetch(`/admin/users/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      {loading || !stats ? (
        <Skeleton className="h-24" />
      ) : (
        <StatsGrid stats={stats} />
      )}
      <Card>
        <form onSubmit={createUser} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Create user</h2>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          <select value={role} onChange={(e) => setRole(e.target.value as 'user' | 'admin')} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
            Create
          </button>
        </form>
      </Card>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users"
        className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3"
      />
      {loading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-[var(--muted)]">{u.email}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {u.transactionCount} tx · {u.accountCount} accounts
                  </p>
                </div>
                <ButtonRow onToggle={() => void toggleActive(u)} onDelete={() => void removeUser(u.id)} active={u.isActive} />
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Audit log</h2>
        <ul className="max-h-64 space-y-2 overflow-auto text-xs text-[var(--muted)]">
          {audit.map((row) => (
            <li key={row.id}>
              <span className="text-[var(--text)]">{row.action}</span> · {row.adminName} · {new Date(row.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card>
        <p className="text-xs text-[var(--muted)]">Total users</p>
        <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
      </Card>
      <Card>
        <p className="text-xs text-[var(--muted)]">Active</p>
        <p className="text-2xl font-semibold tabular-nums">{stats.active}</p>
      </Card>
      <Card>
        <p className="text-xs text-[var(--muted)]">New this month</p>
        <p className="text-2xl font-semibold tabular-nums">{stats.newThisMonth}</p>
      </Card>
    </div>
  )
}

function ButtonRow({ onToggle, onDelete, active }: { onToggle: () => void; onDelete: () => void; active: boolean }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onToggle} className="min-h-10 rounded-xl border border-[var(--border)] px-3">
        {active ? 'Deactivate' : 'Activate'}
      </button>
      <button type="button" onClick={onDelete} className="min-h-10 rounded-xl border border-[var(--expense)] px-3 text-[var(--expense)]">
        Delete
      </button>
    </div>
  )
}
