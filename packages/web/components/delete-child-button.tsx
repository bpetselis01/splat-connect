'use client'
/**
 * Two-step delete for a child profile.
 *
 * Deliberately unlike edit-items-section.tsx and admin/contributors, which both
 * delete on first click: a child profile is a page of hand-entered data with no
 * undo, and a parts row is not. Two clicks rather than a dialog component keeps
 * this to local state with nothing new to maintain.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export function DeleteChildButton({ id }: { id: string }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // An armed button left armed is a trap for whatever the user clicks next.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  async function handleClick() {
    if (!armed) {
      setArmed(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/child-profiles/${id}`)
      router.push('/dashboard/child')
      router.refresh()
    } catch {
      setError('Could not delete this child profile. Please try again.')
      setBusy(false)
      setArmed(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={handleClick} disabled={busy} className="btn btn-danger btn-sm self-start">
        {busy ? 'Deleting…' : armed ? 'Confirm delete' : 'Delete child profile'}
      </button>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
    </div>
  )
}
