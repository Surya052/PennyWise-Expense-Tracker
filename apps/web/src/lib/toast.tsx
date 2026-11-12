import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastPayload = {
  id: number
  message: string
  undo?: () => void
  undoLabel?: string
}

type ToastApi = {
  show: (message: string, undo?: () => void, undoLabel?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const counter = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((message: string, undo?: () => void, undoLabel?: string) => {
    if (timer.current) clearTimeout(timer.current)
    const id = ++counter.current
    setToast({ id, message, undo, undoLabel })
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5000)
  }, [])

  const api = useMemo(() => ({ show }), [show])

  const dismiss = () => setToast(null)

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? (
        <div
          className="fixed bottom-24 left-4 right-4 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm shadow-lg safe-bottom md:bottom-6"
          role="status"
        >
          <span className="text-[var(--text)]">{toast.message}</span>
          <div className="flex shrink-0 items-center gap-2">
            {toast.undo ? (
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-xl px-3 font-medium text-[var(--primary)]"
                onClick={() => {
                  toast.undo?.()
                  dismiss()
                }}
              >
                {toast.undoLabel ?? 'Undo'}
              </button>
            ) : null}
            <button type="button" className="min-h-11 min-w-11 rounded-xl text-[var(--muted)]" onClick={dismiss} aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast requires ToastProvider')
  return ctx
}
