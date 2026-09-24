'use client'

/**
 * The thanks families left, for a leader to read and — when a note should not
 * be on the page — hide (077). Hiding takes the note off "From families" and
 * leaves the thanks in the count: the family still said it.
 *
 * Only notes the author ticked to show can be on the page at all, so those are
 * the only ones with a control; the rest are the family's word to the team.
 */
import { useState } from 'react'
import { Eye, EyeSlash } from '@phosphor-icons/react/dist/ssr'
import type { OrgThanks } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { shortDate } from '@splat-connect/types'

export function OrgThanksNotes({ orgId, thanks: initial }: { orgId: string; thanks: OrgThanks[] }) {
  const [thanks, setThanks] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const notes = thanks.filter((t) => t.note)

  async function setHidden(t: OrgThanks, hidden: boolean) {
    setBusy(t.profile_id)
    try {
      const row = await browserApiClient.patch<OrgThanks>(`/api/organizations/${orgId}/thanks/${t.profile_id}`, { hidden })
      setThanks((all) => all.map((x) => (x.profile_id === t.profile_id ? row : x)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section id="thanks" className="edit-card">
      <div>
        <h2 className="edit-card__title">Thanks from families</h2>
        <p className="edit-card__lede">
          {thanks.length} {thanks.length === 1 ? 'family has' : 'families have'} said thanks. A note
          shows on your page only if its author said it could; hide one and it comes off the page,
          but still counts.
        </p>
      </div>
      {notes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {notes.map((t) => {
            const onPage = t.show_note && !t.hidden_at
            return (
              <li key={t.profile_id} className="flex items-start gap-3 rounded-[18px] border border-line bg-[var(--canvas)] p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm text-ink">&ldquo;{t.note}&rdquo;</p>
                  <p className="m-0 mt-1 text-[13px] font-bold text-muted">
                    {t.byline ?? 'A family'} · {shortDate(t.created_at)} ·{' '}
                    {!t.show_note ? 'Just for you' : onPage ? 'On your page' : 'Hidden'}
                  </p>
                </div>
                {t.show_note && (
                  <button
                    type="button"
                    disabled={busy === t.profile_id}
                    onClick={() => void setHidden(t, onPage)}
                    className="btn btn-quiet btn-sm"
                  >
                    {onPage ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    {onPage ? 'Hide' : 'Show again'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
