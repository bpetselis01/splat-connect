'use client'
/**
 * The submission form behind /get-involved/submit-an-idea.
 *
 * Posts through lib/browser-api-client.ts rather than straight to the Hono
 * API (contrast components/notify-form.tsx, which posts directly because its
 * endpoint is deliberately unauthenticated). POST /api/ideas sits behind
 * authMiddleware, so this needs the Supabase session token that
 * browser-api-client.ts attaches — posting the notify-form way would send no
 * token and get a 401.
 *
 * On success this navigates away immediately (to /dashboard/challenges), so
 * there is no lingering success message that needs the focus-and-role=status
 * treatment notify-form uses for its own unmounting-form problem. The error
 * path still needs the same care notify-form gives success: never swallowed,
 * always readable.
 */
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'
import { CONTACT_PREFS, type ContactPref, type ToyIdea } from '@splat-connect/types'

const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

type Fields = {
  title: string
  summary: string
  description: string
  intended_use: string
  primary_user: string
  contact_prefs: ContactPref[]
}

const EMPTY_FIELDS: Fields = {
  title: '',
  summary: '',
  description: '',
  intended_use: '',
  primary_user: '',
  contact_prefs: [],
}

export function IdeaForm() {
  const router = useRouter()
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function togglePref(pref: ContactPref) {
    setFields((prev) => ({
      ...prev,
      contact_prefs: prev.contact_prefs.includes(pref)
        ? prev.contact_prefs.filter((p) => p !== pref)
        : [...prev.contact_prefs, pref],
    }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()

    // Mirrors readIdeaBody in packages/api/src/routes/toy-ideas.ts: every
    // narrative field is required and whitespace-only is rejected. The
    // server enforces this regardless — this just saves a round trip for the
    // ordinary case of an empty textarea, per the brief: never rely on the
    // client check alone.
    const trimmed = {
      title: fields.title.trim(),
      summary: fields.summary.trim(),
      description: fields.description.trim(),
      intended_use: fields.intended_use.trim(),
      primary_user: fields.primary_user.trim(),
    }
    if (Object.values(trimmed).some((v) => !v)) {
      setError('All fields are required')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post<ToyIdea>('/api/ideas', {
        ...trimmed,
        contact_prefs: fields.contact_prefs,
      })
      router.push('/dashboard/challenges')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this idea. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 flex flex-col gap-4 p-6">
      <div>
        <label htmlFor="idea-title" className="field-label">
          Idea name
        </label>
        <input
          id="idea-title"
          type="text"
          required
          value={fields.title}
          onChange={(e) => set('title', e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="idea-summary" className="field-label">
          Summarise it in one sentence
        </label>
        <input
          id="idea-summary"
          type="text"
          required
          value={fields.summary}
          onChange={(e) => set('summary', e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="idea-description" className="field-label">
          Full description
        </label>
        <textarea
          id="idea-description"
          required
          rows={4}
          value={fields.description}
          onChange={(e) => set('description', e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="idea-intended-use" className="field-label">
          Intended use
        </label>
        <textarea
          id="idea-intended-use"
          required
          rows={3}
          value={fields.intended_use}
          onChange={(e) => set('intended_use', e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="idea-primary-user" className="field-label">
          Primary user
        </label>
        <textarea
          id="idea-primary-user"
          required
          rows={3}
          value={fields.primary_user}
          onChange={(e) => set('primary_user', e.target.value)}
          className="field"
        />
      </div>

      <fieldset>
        <legend className="field-label">I&apos;m happy to be contacted for…</legend>
        <div className="flex flex-col gap-1">
          {CONTACT_PREFS.map((pref) => (
            <label
              key={pref}
              htmlFor={`idea-pref-${pref}`}
              className="flex items-center gap-2 text-sm text-ink"
            >
              <input
                id={`idea-pref-${pref}`}
                type="checkbox"
                className="field-check"
                checked={fields.contact_prefs.includes(pref)}
                onChange={() => togglePref(pref)}
              />
              {CONTACT_PREF_LABELS[pref]}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-accent self-start">
        {busy ? 'Submitting…' : 'Submit idea'}
      </button>
    </form>
  )
}
