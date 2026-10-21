'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function MarkAllReadButton({ action }: { action: () => Promise<number> }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(0)

  async function run() {
    setBusy(true)
    try {
      setFailed(await action())
    } catch {
      setFailed(-1)
    } finally {
      setBusy(false)
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn btn-quiet" disabled={busy} onClick={run}>
        Mark all read
      </button>
      {failed !== 0 && (
        <p role="alert" className="text-sm text-danger">
          {failed > 0
            ? `${failed} ${failed === 1 ? 'notification' : 'notifications'} could not be marked read. Try again.`
            : 'Could not mark your notifications read. Try again.'}
        </p>
      )}
    </div>
  )
}
