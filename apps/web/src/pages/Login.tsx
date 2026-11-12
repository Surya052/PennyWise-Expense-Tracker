import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import type { PublicUser } from '../lib/auth'
import { useAuth } from '../lib/auth'
import { Card } from '../components/Card'

export function Login() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await apiFetch<{ user: PublicUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, remember }),
      })
      setUser(data.user)
      navigate(data.user.mustChangePassword ? '/change-password' : '/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4 safe-top safe-bottom">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-center text-2xl font-semibold text-[var(--text)]">PennyWise</h1>
        <p className="mb-6 text-center text-sm text-[var(--muted)]">Track every rupee in one calm place</p>
        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-[var(--text)]">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[var(--text)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--text)]">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-[var(--text)]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            {error ? <p className="text-sm text-[var(--expense)]" role="alert">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)] disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/forgot" className="text-[var(--primary)]">
              Forgot password?
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
