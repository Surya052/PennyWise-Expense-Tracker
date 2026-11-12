import { useState, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { Card } from '../components/Card'

export function Reset() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await apiFetch('/auth/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })
      navigate('/login')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-4 text-xl font-semibold text-[var(--text)]">Choose a new password</h1>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-[var(--text)]">
              Reset token
              <input
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-[var(--text)]">
              New password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
              />
            </label>
            {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
            <button type="submit" disabled={busy} className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
              Update password
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/login">Sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
