'use client'

/**
 * The notes people left when they thanked you, to read and hide (117). Private
 * to you, so Hide only tidies this list; the thanks still counts. A failed
 * PATCH says so and leaves the row as it was.
 */
import { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr'
import { shortDate, type PersonThanks } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function PersonThanksNotes({ thanks: initial }: { thanks: PersonThanks[] }) {
  const [thanks, setThanks] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const notes = thanks.filter((t) => t.note)

  async function setHidden(t: PersonThanks, hidden: boolean) {
    setBusy(t.thanker_id)
    setError(null)
    try {
      const row = await browserApiClient.patch<PersonThanks>(`/api/contributors/me/thanks/${t.thanker_id}`, { hidden })
      setThanks((all) => all.map((x) => (x.thanker_id === t.thanker_id ? row : x)))
    } catch {
      setError('Could not change that note. Try again.')
    } finally {
      setBusy(null)
    }
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-[18px] border border-line bg-surface p-6 text-center">
        <p className="m-0 font-display text-xl font-extrabold text-ink">No notes yet</p>
        <p className="m-0 mt-1 text-sm text-muted">When someone thanks you with a note, it shows up here.</p>
      </div>
    )
  }

  return (
    <section>
      {error && <p role="alert" className="mb-2.5 text-sm font-semibold text-[var(--bad)]">{error}</p>}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {notes.map((t) => {
          const hidden = !!t.hidden_at
          return (
            <li key={t.thanker_id} className="flex items-start gap-3 rounded-[18px] border border-line bg-[var(--canvas)] p-3.5">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm text-ink">&ldquo;{t.note}&rdquo;</p>
                <p className="m-0 mt-1 text-[13px] font-bold text-muted">
                  {t.byline ?? 'A family'} · {shortDate(t.created_at)}
                  {hidden ? ' · Hidden' : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === t.thanker_id}
                onClick={() => void setHidden(t, !hidden)}
                aria-label={`${hidden ? 'Show' : 'Hide'} the note from ${t.byline ?? 'a family'}`}
                className="btn btn-quiet btn-sm"
              >
                {hidden ? <Eye aria-hidden="true" /> : <EyeSlash aria-hidden="true" />}
                {hidden ? 'Show' : 'Hide'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
