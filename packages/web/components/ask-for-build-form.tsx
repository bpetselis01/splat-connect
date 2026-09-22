'use client'

/**
 * Asking somebody to build a guide for you.
 *
 * Three questions and nothing else: which guide, who you are asking, and what
 * they need to know. Everything else about the build — cost, pickup, dates — is
 * agreed in the thread this creates, which is the same rule `/toys/[id]/request`
 * follows and the reason the note is the only free text here.
 *
 * The maker list is organisations. A person can be asked too (057 allows it,
 * gated on their having a public profile), but reaching them is done from their
 * own profile page rather than from a directory of every account, which is a
 * spam surface nobody asked for.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { Hammer } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export interface BuildOption {
  id: string
  label: string
}

export function AskForBuildForm({
  guides,
  makers,
  defaultGuideId,
  /** Set when the ask started from one person's profile rather than the list. */
  makerId,
  makerName,
}: {
  guides: BuildOption[]
  makers: BuildOption[]
  defaultGuideId?: string
  makerId?: string
  makerName?: string
}) {
  const router = useRouter()
  const [guideId, setGuideId] = useState(defaultGuideId ?? guides[0]?.id ?? '')
  const [makerOrgId, setMakerOrgId] = useState(makers[0]?.id ?? '')
  const [brief, setBrief] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const askingAPerson = Boolean(makerId)
  const valid = guideId !== '' && brief.trim().length > 0 && (askingAPerson || makerOrgId !== '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setError(null)
    startTransition(async () => {
      try {
        const tx = await browserApiClient.post<{ id: string }>('/api/toy-transactions/build', {
          tutorial_id: guideId,
          build_brief: brief.trim(),
          ...(askingAPerson ? { maker_id: makerId } : { maker_org_id: makerOrgId }),
        })
        router.push(`/dashboard/exchanges/build/${tx.id}` as Route)
      } catch (err) {
        // The API's own sentence where there is one — "you already have an open
        // build request with them for this guide" is worth reading, and a
        // generic failure line would throw it away.
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not send. Check your connection and try again.')
      }
    })
  }

  if (guides.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        There are no published guides to build yet.
      </p>
    )
  }

  return (
    <form className="card flex flex-col gap-5 p-6" onSubmit={submit}>
      <label>
        <span className="field-label">Which guide</span>
        <select
          className="field mt-1 w-full"
          value={guideId}
          onChange={(e) => setGuideId(e.target.value)}
        >
          {guides.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      {askingAPerson ? (
        <p className="text-sm leading-relaxed text-muted">
          You are asking <strong className="text-ink">{makerName}</strong>. They can take it on or
          decline, and either way you will hear back in the thread.
        </p>
      ) : makers.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted">
          No organisation is listed as active yet, so there is nobody to ask.
        </p>
      ) : (
        <label>
          <span className="field-label">Who you are asking</span>
          <select
            className="field mt-1 w-full"
            value={makerOrgId}
            onChange={(e) => setMakerOrgId(e.target.value)}
          >
            {makers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        <span className="field-label">What they need to know</span>
        <textarea
          className="field mt-1 w-full"
          rows={5}
          maxLength={2000}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Who it is for, the switch they use, and anything about the toy that matters."
        />
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary self-start" disabled={!valid || pending}>
        <Hammer size={18} weight="bold" aria-hidden="true" />
        Send the request
      </button>
    </form>
  )
}
