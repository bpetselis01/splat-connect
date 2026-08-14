'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import Link from 'next/link'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Toy, ToyTransaction, ToyWithOwner } from '@splat-connect/types'

export function ToyTransactionRequest({
  toy,
  viewerId,
  myToys,
}: {
  toy: ToyWithOwner
  viewerId: string | null
  myToys: Toy[]
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'choosing-exchange'>('idle')
  const [offeredToyId, setOfferedToyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!viewerId) {
    return (
      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-dark underline">
          Sign in
        </Link>{' '}
        to request this toy.
      </p>
    )
  }
  if (viewerId === toy.owner_id) return null
  if (!toy.offer_type) {
    return <p className="text-sm text-muted">Not currently offered for donation or exchange.</p>
  }

  async function start(type: 'donation' | 'exchange', offered_toy_id?: string) {
    setBusy(true)
    setError(null)
    try {
      const tx = await browserApiClient.post<ToyTransaction>('/api/toy-transactions', {
        toy_id: toy.id,
        type,
        ...(offered_toy_id ? { offered_toy_id } : {}),
      })
      router.push(`/dashboard/exchanges/${tx.id}` as Route<string>)
    } catch {
      setError('Could not start this request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const canDonate = toy.offer_type === 'donation' || toy.offer_type === 'both'
  const canExchange = toy.offer_type === 'exchange' || toy.offer_type === 'both'

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {canDonate && (
        <button type="button" disabled={busy} onClick={() => start('donation')} className="btn btn-accent">
          Arrange pickup
        </button>
      )}
      {canExchange && mode === 'idle' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (myToys.length === 0) {
              setError('Add a toy to My Toys before you can offer an exchange.')
              return
            }
            setMode('choosing-exchange')
          }}
          className="btn btn-quiet"
        >
          Arrange exchange
        </button>
      )}
      {mode === 'choosing-exchange' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="offered-toy" className="field-label">
            Offer one of your toys
          </label>
          <select
            id="offered-toy"
            className="field"
            value={offeredToyId}
            onChange={(e) => setOfferedToyId(e.target.value)}
          >
            <option value="">Choose a toy…</option>
            {myToys.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !offeredToyId}
            onClick={() => start('exchange', offeredToyId)}
            className="btn btn-accent"
          >
            {busy ? 'Starting…' : 'Start exchange'}
          </button>
        </div>
      )}
    </div>
  )
}
