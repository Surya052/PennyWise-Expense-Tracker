import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, ApiError } from '../lib/api'
import { Card } from '../components/Card'

export function Forgot() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      const data = await apiFetch<{ message: string; resetToken?: string }>('/auth/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(data.message)
      if (data.resetToken) {
        setMessage(`${data.message} Token (dev): ${data.resetToken}`)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="mb-2 text-xl font-semibold text-[var(--text)]">Reset password</h1>
          <p className="mb-4 text-sm text-[var(--muted)]">We will send a reset link if the email is registered.</p>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm text-[var(--text)]">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
              />
            </label>
            {error ? <p className="text-sm text-[var(--expense)]">{error}</p> : null}
            {message ? <p className="text-sm text-[var(--income)]">{message}</p> : null}
            <button type="submit" disabled={busy} className="min-h-11 rounded-2xl bg-[var(--btn)] font-semibold text-[var(--surface)]">
              Send link
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <Link to="/login">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
