import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import type { PublicUser } from '../lib/auth'
import { useAuth } from '../lib/auth'
import { Card } from '../components/Card'

export function ChangePassword() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await apiFetch<{ user: PublicUser }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setUser(data.user)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-2 text-xl font-semibold text-[var(--text)]">Set a new password</h1>
          <p className="mb-4 text-sm text-[var(--muted)]">Use at least 8 characters with upper, lower, and a digit.</p>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Current password
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              New password
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
              />
            </label>
            {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
            <button type="submit" disabled={busy} className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
              Save password
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
