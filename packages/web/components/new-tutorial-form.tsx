'use client'
/**
 * Creates the tutorial row and hands straight over to the editor, replacing
 * the six-step wizard this page used to run. Everything the wizard collected
 * after step 1 — files, parts, tools, STL, backing, submit — already exists as
 * a step on the edit page, so the wizard was a second implementation of all of
 * it plus a sessionStorage draft to survive the walk.
 *
 * The board asks for the two things a draft is recognisable by — what kind of
 * guide, what the toy is, and one photo — and leaves everything else to the
 * editor. Kind is a radio card pair here rather than a page before the form.
 *
 * The id is generated here rather than by the database, which is what makes
 * POST /api/tutorials retry-safe: the route turns a duplicate-key error back
 * into a success for the same id.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { ArrowRight, Cube, Dog, Image as ImageIcon } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Difficulty, Tutorial, TutorialKind } from '@splat-connect/types'

const KINDS: { kind: TutorialKind; label: string; sub: string; Icon: typeof Cube }[] = [
  { kind: 'toy_adaptation', label: 'Toy adaptation', sub: 'A shop toy rewired for a switch', Icon: Dog },
  { kind: 'assistive_tech', label: 'Assistive tech', sub: 'Something printed or built from scratch', Icon: Cube },
]

const KIND_NOTE: Record<TutorialKind, string> = {
  toy_adaptation:
    'Toy adaptations have no STL step. Switch to Assistive tech if you have an STL to attach.',
  assistive_tech: 'Assistive tech guides get an STL step for the files you printed with.',
}

export function NewTutorialForm({ kind: initialKind = 'toy_adaptation' }: { kind?: TutorialKind }) {
  const router = useRouter()
  const [kind, setKind] = useState<TutorialKind>(initialKind)
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [cover, setCover] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = useMemo(() => (cover ? URL.createObjectURL(cover) : null), [cover])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const id = crypto.randomUUID()
    try {
      await browserApiClient.post('/api/tutorials', {
        id,
        title,
        description: null,
        difficulty,
        kind,
      })
      await browserApiClient.post(`/api/contributors/me/tutorials/${id}`, {})
    } catch {
      setError('Could not create this tutorial. Please try again.')
      setBusy(false)
      return
    }

    // The photo route checks the caller is a contributor on the tutorial, so it
    // can only run once the row and the link exist. A failed photo does not
    // undo the draft: the editor opens on the step where photos are added, and
    // the missing cover is visible there.
    if (cover) {
      try {
        const fd = new FormData()
        fd.append('file', cover)
        fd.append('tutorialId', id)
        const { url } = await browserApiClient.postFormData<{ url: string }>('/api/upload/photo', fd)
        const current = await browserApiClient.get<Tutorial>(`/api/tutorials/${id}`)
        await browserApiClient.patch(`/api/tutorials/${id}`, {
          photo_urls: [url],
          updated_at: current.updated_at,
        })
      } catch {
        // ponytail: silent — the Files step shows no photo; surface a toast if people miss it.
      }
    }

    // Straight on to Files. created=1 is what makes the handover audible:
    // CreatedToast turns it into a toast and drops it from the URL.
    router.push(`/tutorials/${id}/edit?step=files&created=1` as Route<string>)
  }

  return (
    <form onSubmit={create} className="upload-card">
      <div>
        <span className="upload-card__label" id="new-tutorial-kind">
          What kind of guide is this?
        </span>
        <div role="radiogroup" aria-labelledby="new-tutorial-kind" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              onClick={() => setKind(k.kind)}
              className="kind-card"
            >
              <k.Icon size={26} weight="duotone" aria-hidden="true" className="flex-none text-brand-dark" />
              <span>
                <span className="block text-[15px] font-extrabold">{k.label}</span>
                <span className="mt-0.5 block text-[13px] leading-[1.4] text-muted">{k.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">{KIND_NOTE[kind]}</p>
      </div>

      <div>
        <label htmlFor="new-tutorial-title" className="upload-card__label">Title</label>
        <input
          id="new-tutorial-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Switch-adapted light-up drum"
          required
          className="field upload-card__field"
        />
      </div>

      <div>
        <label htmlFor="new-tutorial-cover" className="upload-card__label">Cover photo</label>
        <label
          htmlFor="new-tutorial-cover"
          className="upload-cover"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file?.type.startsWith('image/')) setCover(file)
          }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a served image
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-[13px] font-bold text-muted">
              <ImageIcon size={26} aria-hidden="true" />
              Drop the finished toy&apos;s photo here
            </span>
          )}
        </label>
        <input
          id="new-tutorial-cover"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
          onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <p className="mt-2 text-[13px] text-muted">
          The adapted toy, finished, on a plain surface. This is the only image a parent sees
          before they click.
        </p>
      </div>

      <div>
        <label htmlFor="new-tutorial-difficulty" className="upload-card__label">Difficulty</label>
        <select
          id="new-tutorial-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="field upload-card__field"
        >
          <option value="easy">Easy — interrupter only</option>
          <option value="medium">Medium — some soldering</option>
          <option value="hard">Hard — opening the case</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-primary self-start">
        {busy ? 'Creating…' : 'Create draft and open the editor'}
        {!busy && <ArrowRight size={18} weight="bold" aria-hidden="true" />}
      </button>
    </form>
  )
}
