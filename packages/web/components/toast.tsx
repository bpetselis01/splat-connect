'use client'
/**
 * One shared toast for every edit-page save action. useToast() defaults to a
 * no-op outside a ToastProvider so section components — most of which already
 * have standalone unit tests that render them without a provider — keep
 * working unchanged; only the live app (ToastProvider lives in EditStepper)
 * ever shows anything.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ShowToast = (message: string) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setMessage(msg)
    timeoutRef.current = setTimeout(() => setMessage(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && (
        <div role="status" aria-live="polite" className="edit-toast">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
