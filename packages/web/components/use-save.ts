'use client'
/**
 * The busy/error/saved trio every panel form carried its own copy of.
 *
 * Six forms held three useStates and the same eleven lines around their save
 * call — including the same message and the same `setSaved(false)` on a new
 * attempt, which is the rule terms-gate.tsx states about its own request: never
 * tell the user a change was recorded when the server did not record it. One
 * copy of that is easier to keep honest than six.
 *
 * `run` resolves true or false rather than throwing, so a caller that has to
 * decide something on the outcome (toy-details-form parks its save with
 * useSaveOnLeave, which wants a boolean) can, and the rest can ignore it.
 *
 * Not used by components/toy-photos-section.tsx: that one uploads before it
 * saves, so its error is whatever the upload threw rather than a fixed
 * sentence, and it reports success with a toast instead of a `saved` flag.
 */
import { useState } from 'react'

export function useSave<A extends unknown[]>(onSave: (...args: A) => Promise<unknown>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function run(...args: A): Promise<boolean> {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await onSave(...args)
      setSaved(true)
      return true
    } catch {
      setError('Could not save your changes. Please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, saved, run }
}
