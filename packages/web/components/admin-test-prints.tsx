'use client'
/**
 * The verification queue (098): a photo of each printer's SPLAT test print,
 * waiting ones first. Pass or fail, with a note the owner reads.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

/** One row of GET /api/admin/test-prints. `photo` is a short-lived signed URL the API built. */
export type AdminTestPrint = {
  id: string
  printer_name: string | null
  owner_name: string | null
  photo: string | null
  submitted_at: string
  verdict: 'pass' | 'fail' | null
  note: string | null
}

export function AdminTestPrints({ prints }: { prints: AdminTestPrint[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function judge(id: string, verdict: 'pass' | 'fail') {
    setError(null)
    setBusy(id)
    try {
      await browserApiClient.patch(`/api/admin/test-prints/${id}`, { verdict, note: notes[id] ?? '' })
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(null)
    }
  }

  if (prints.length === 0) {
    return (
      <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
        No test prints yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <ul className="flex list-none flex-col gap-4 p-0">
        {prints.map((p) => {
          const name = p.printer_name ?? 'A printer'
          return (
            <li key={p.id} className="card flex flex-col gap-3 p-5 sm:flex-row">
              {p.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- a signed storage URL that expires; nothing to optimise
                <img src={p.photo} alt={`Test print from ${name}`} className="h-40 w-40 flex-none rounded-field object-cover" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="font-extrabold text-ink">{name}</p>
                <p className="text-sm text-muted">{p.owner_name ?? 'Unknown owner'}</p>
                {p.verdict === null ? (
                  <>
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Note
                      <textarea
                        aria-label={`Note for ${name}`}
                        className="field rounded-[var(--radius-inset)]"
                        rows={2}
                        maxLength={500}
                        value={notes[p.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => judge(p.id, 'pass')}>
                        Pass
                      </button>
                      <button type="button" className="btn btn-quiet btn-sm" disabled={busy === p.id} onClick={() => judge(p.id, 'fail')}>
                        Fail
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-bold text-ink">
                    {p.verdict === 'pass' ? 'Passed' : 'Failed'}
                    {p.note ? ` — ${p.note}` : ''}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
