import { useEffect, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-auto rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl safe-bottom md:rounded-[24px]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
          <button type="button" className="min-h-11 min-w-11 rounded-xl text-[var(--muted)]" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
