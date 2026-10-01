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
import { ChatsCircle, Lightbulb } from '@phosphor-icons/react/dist/ssr'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'
import { CONTACT_PREFS, type ContactPref, type ToyIdea, type ToyIdeaKind } from '@splat-connect/types'

const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

/** The board's two tiles (078): what the idea becomes once an admin opens it. */
const KINDS: { kind: ToyIdeaKind; label: string; sub: string; Icon: typeof Lightbulb }[] = [
  { kind: 'challenge', label: 'A toy worth adapting', sub: 'Becomes a build challenge makers can pick up.', Icon: Lightbulb },
  {
    kind: 'question',
    label: 'A question for the community',
    sub: 'No build needed. Makers and OTs answer in the thread; you mark the answer that helped.',
    Icon: ChatsCircle,
  },
]

type Fields = {
  kind: ToyIdeaKind
  title: string
  summary: string
  description: string
  contact_prefs: ContactPref[]
}

const EMPTY_FIELDS: Fields = {
  kind: 'challenge',
  title: '',
  summary: '',
  description: '',
  contact_prefs: [],
}

/** `initial`: the rejected idea a revised one starts from (challenge-author-states). */
export function IdeaForm({ initial }: { initial?: ToyIdea } = {}) {
  const router = useRouter()
  const [fields, setFields] = useState<Fields>(
    initial
      ? {
          kind: initial.kind ?? 'challenge',
          title: initial.title,
          summary: initial.summary,
          description: initial.description ?? '',
          contact_prefs: initial.contact_prefs,
        }
      : EMPTY_FIELDS
  )
  // 106: the upload's path is what the idea takes; its url is the preview.
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(
    initial?.photo_path && initial.photo_url ? { path: initial.photo_path, url: initial.photo_url } : null
  )
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false)
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

    // Mirrors readIdeaBody: a title and a summary are required (103).
    const title = fields.title.trim()
    const summary = fields.summary.trim()
    if (!title || !summary) {
      setError('A title and a summary are required.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post<ToyIdea>('/api/ideas', {
        title,
        summary,
        description: fields.description.trim() || null,
        kind: fields.kind,
        contact_prefs: fields.contact_prefs,
        photo_path: photo?.path ?? null,
        anonymous,
      })
      router.push('/dashboard/challenges')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit this idea. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card mt-[30px] flex flex-col gap-5 p-7">
      <fieldset>
        <legend className="field-label">What are you sharing?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map(({ kind, label, sub, Icon }) => {
            const on = fields.kind === kind
            return (
              <label
                key={kind}
                className="flex cursor-pointer items-start gap-3 rounded-[18px] border-2 p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[var(--focus)]"
                style={{
                  borderColor: on ? 'var(--b600)' : 'var(--line)',
                  background: on ? 'var(--b50)' : 'var(--surface)',
                }}
              >
                <input
                  type="radio"
                  name="idea-kind"
                  value={kind}
                  checked={on}
                  onChange={() => set('kind', kind)}
                  className="sr-only"
                />
                <Icon weight="duotone" aria-hidden="true" className="shrink-0 text-2xl text-[var(--b600)]" />
                <span>
                  <span className="block text-[15px] font-extrabold text-ink">{label}</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.5] text-muted">{sub}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="idea-title" className="field-label">
          {fields.kind === 'question' ? 'Your question' : 'Title'}
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
          Summary
        </label>
        <p id="idea-summary-hint" className="mb-2 text-[13px] text-muted">
          One or two sentences. This is what appears on the challenge card.
        </p>
        <input
          id="idea-summary"
          aria-describedby="idea-summary-hint"
          type="text"
          required
          value={fields.summary}
          onChange={(e) => set('summary', e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="idea-description" className="field-label">
          Why it matters
        </label>
        <textarea
          id="idea-description"
          rows={4}
          placeholder="Who would use it, and what they cannot do today."
          value={fields.description}
          onChange={(e) => set('description', e.target.value)}
          className="field"
        />
      </div>

      {/* The board's words (WB submit-an-idea). */}
      <div>
        <span className="field-label">Photos (optional)</span>
        <label className="grid min-h-[150px] cursor-pointer place-items-center overflow-hidden rounded-[18px] border border-dashed border-line text-sm font-bold text-muted has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-[var(--focus)]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview, not a page image
            <img src={photo.url} alt="Your photo" className="h-[150px] w-full object-cover" />
          ) : (
            'Drop a photo of the toy'
          )}
          <input
            type="file"
            accept="image/*"
            aria-label="Drop a photo of the toy"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData()
              fd.append('file', file)
              setError(null)
              try {
                setPhoto(await browserApiClient.postFormData<{ path: string; url: string }>('/api/upload/idea-photo', fd))
              } catch {
                setError('Could not upload the photo. Please try again.')
              }
            }}
          />
        </label>
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

      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" className="field-check mt-0.5" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Post this anonymously. Your name will not appear on the challenge.
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="border-t border-line pt-1.5">
        <button type="submit" disabled={busy} className="btn btn-primary mt-3 px-[26px]">
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </form>
  )
}
