import { useState, type FormEvent } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import { useAuth, type PublicUser } from '../lib/auth'
import { Card } from '../components/Card'

export function Settings() {
  const { user, setUser, refresh } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [currency, setCurrency] = useState(user?.currency ?? 'INR')
  const [dateFormat, setDateFormat] = useState(user?.dateFormat ?? 'DD/MM/YYYY')
  const [monthStartDay, setMonthStart] = useState(String(user?.monthStartDay ?? 1))
  const [theme, setTheme] = useState(user?.theme ?? 'system')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deletePassword, setDeletePassword] = useState('')

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    try {
      const data = await apiFetch<{ user: PublicUser }>('/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          currency,
          dateFormat,
          monthStartDay: Number(monthStartDay),
          theme,
        }),
      })
      if (data.user) setUser(data.user)
      setMessage('Profile updated')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed')
    }
  }

  async function exportJson() {
    const data = await apiFetch<Record<string, unknown>>('/settings/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pennywise-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiFetch('/settings/delete-account', {
        method: 'POST',
        body: JSON.stringify({ email: deleteEmail, password: deletePassword }),
      })
      window.location.assign('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">Settings</h1>
      <Card>
        <form onSubmit={saveProfile} className="flex flex-col gap-3">
          <label className="text-sm">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <label className="text-sm">
            Currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3">
              {['INR', 'USD', 'EUR', 'GBP', 'AED'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Date format
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3">
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </label>
          <label className="text-sm">
            First day of month
            <input
              type="number"
              min={1}
              max={28}
              value={monthStartDay}
              onChange={(e) => setMonthStart(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
            />
          </label>
          <label className="text-sm">
            Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3">
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          {message ? <p className="text-sm text-[var(--income)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
            Save profile
          </button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold">Export</h2>
        <button type="button" onClick={() => void exportJson()} className="min-h-11 rounded-2xl border border-[var(--border)] px-4 text-sm text-[var(--primary)]">
          Download JSON export
        </button>
      </Card>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-[var(--expense)]">Delete account</h2>
        <form onSubmit={deleteAccount} className="flex flex-col gap-3">
          <label className="text-sm">
            Confirm email
            <input value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <label className="text-sm">
            Current password
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3" />
          </label>
          <button type="submit" className="min-h-11 rounded-2xl bg-[var(--expense)] font-semibold text-[var(--surface)]">
            Delete my account
          </button>
        </form>
      </Card>
      <button type="button" className="text-sm text-[var(--muted)]" onClick={() => void refresh()}>
        Refresh session
      </button>
    </div>
  )
}
