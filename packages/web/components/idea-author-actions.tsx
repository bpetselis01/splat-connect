'use client'
/**
 * The author's two moves on their own idea before it is public
 * (challenge-author-states): withdraw it while pending, or start a revised one
 * once it is rejected. A rejected idea is never edited — the revised one is
 * new, so the thing an admin judged stays as it was.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ToyIdeaStatus } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { useToast } from '@/components/toast'

export function IdeaAuthorActions({ id, status }: { id: string; status: ToyIdeaStatus }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'rejected') {
    return (
      <Link href={`/get-involved/submit-an-idea?from=${id}`} className="btn btn-coral min-h-11 px-[18px] text-sm">
        Submit a revised idea
      </Link>
    )
  }
  if (status !== 'pending') return null

  async function withdraw() {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/ideas/${id}`)
      toast('Withdrawn — nothing was published')
      router.refresh()
    } catch {
      setError('Could not withdraw this idea. Please try again.')
      setBusy(false)
    }
  }

  return (
    <span className="flex flex-col gap-1.5">
      <button type="button" disabled={busy} onClick={withdraw} className="btn btn-quiet min-h-11 px-[18px] text-sm">
        Withdraw the idea
      </button>
      {error && (
        <span role="alert" className="text-[13px] text-[var(--bad)]">
          {error}
        </span>
      )}
    </span>
  )
}
