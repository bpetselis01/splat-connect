'use client'
/**
 * Add a toy — the board's one card: what kind of toy, what it is, and its
 * photos, then the listing editor takes over. Condition stays here because the
 * row cannot exist without one (021: NOT NULL, no default).
 *
 * Photos and "switch-adapted" are not columns the create route writes, so they
 * follow in one PATCH once the row exists — the photo route checks ownership
 * of a toy id, which is why it cannot run first. A failed photo does not undo
 * the toy: the editor's Photos section shows what did arrive.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Gift, HandTap, Images } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Organization, Toy } from '@splat-connect/types'

const MAX_PHOTOS = 5

const KINDS = [
  { wired: true, label: 'Switch-adapted', sub: 'Already wired for a 3.5 mm switch', Icon: HandTap },
  { wired: false, label: 'Standard toy', sub: 'Not adapted — good for a family who wants to adapt it', Icon: Gift },
]

export function NewToyForm({ ledOrgs = [] }: { ledOrgs?: Organization[] }) {
  const router = useRouter()
  const [wired, setWired] = useState(true)
  const [name, setName] = useState('')
  const [condition, setCondition] = useState(5)
  // Empty string means "mine". A leader adding a personal toy is the ordinary
  // case and stays the default, so leadership never quietly redirects a toy
  // away from the person who added it.
  const [orgId, setOrgId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  function addPhotos(files: FileList | null) {
    const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'))
    setPhotos((prev) => [...prev, ...images].slice(0, MAX_PHOTOS))
  }

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    let toy: Toy
    try {
      toy = await browserApiClient.post<Toy>('/api/toys', {
        name,
        condition,
        description: null,
        ...(orgId ? { owner_org_id: orgId, quantity } : {}),
      })
    } catch {
      setError('Could not create this toy. Please try again.')
      setBusy(false)
      return
    }

    const urls: string[] = []
    for (const file of photos) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('toyId', toy.id)
        const { url } = await browserApiClient.postFormData<{ url: string }>('/api/upload/toy-photo', fd)
        urls.push(url)
      } catch {
        // ponytail: skipped silently — the editor's Photos section shows the gap.
      }
    }
    if (wired || urls.length) {
      await browserApiClient
        .patch(`/api/toys/${toy.id}`, {
          ...(wired ? { switch_adapted: true } : {}),
          ...(urls.length ? { photo_urls: urls } : {}),
        })
        .catch(() => {})
    }
    router.push(`/dashboard/toys/${toy.id}`)
  }

  return (
    <form onSubmit={create} className="upload-card">
      <div>
        <span className="upload-card__label" id="new-toy-kind">
          What kind of toy is this?
        </span>
        <div role="radiogroup" aria-labelledby="new-toy-kind" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button
              key={k.label}
              type="button"
              role="radio"
              aria-checked={wired === k.wired}
              onClick={() => setWired(k.wired)}
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
        <p className="mt-2 text-[13px] text-muted">
          {wired
            ? 'Adapted toys are what most families search for first. It will show the switch fitting on its card.'
            : 'Worth listing anyway — plenty of families want a toy they can adapt themselves.'}
        </p>
      </div>

      <div>
        <label htmlFor="new-toy-name" className="upload-card__label">What is it?</label>
        <input
          id="new-toy-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Light-up drum"
          required
          className="field upload-card__field"
        />
      </div>

      {/* Only a leader ever sees this. For everyone else there is one possible
          answer, and a select with one option is a question not worth asking. */}
      {ledOrgs.length > 0 && (
        <div>
          <label htmlFor="new-toy-owner" className="upload-card__label">Who holds this toy</label>
          <select
            id="new-toy-owner"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="field upload-card__field"
          >
            <option value="">Me</option>
            {ledOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stock only means something for an organisation: a person holds one
          object, which is a rule the database enforces rather than assumes. */}
      {orgId && (
        <div>
          <label htmlFor="new-toy-quantity" className="upload-card__label">How many do you hold</label>
          <input
            id="new-toy-quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="field upload-card__field"
          />
          <p className="mt-1 text-xs text-muted">
            Five of the same bear is one listing with a count of five, not five listings.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="new-toy-condition" className="upload-card__label">Condition (1–10)</label>
        <input
          id="new-toy-condition"
          type="number"
          min={1}
          max={10}
          value={condition}
          onChange={(e) => setCondition(Number(e.target.value))}
          className="field upload-card__field"
        />
      </div>

      <div>
        <label htmlFor="new-toy-photos" className="upload-card__label mb-1">Photos</label>
        <p className="mb-2.5 text-[13px] text-muted">
          Up to five. The first one families see is the cover — you can change which that is later.
        </p>
        <label
          htmlFor="new-toy-photos"
          className="upload-cover upload-cover--brand"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            addPhotos(e.dataTransfer.files)
          }}
        >
          {previews.length ? (
            <span className="grid w-full grid-cols-5 gap-2 self-stretch p-3">
              {previews.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- local blob previews
                <img key={src} src={src} alt="" className="h-full w-full rounded-[14px] object-cover" />
              ))}
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-[13px] font-bold text-muted">
              <Images size={26} aria-hidden="true" />
              Drop up to five photos of the toy here
            </span>
          )}
        </label>
        <input
          id="new-toy-photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
          onChange={(e) => addPhotos(e.target.files)}
          className="sr-only"
        />
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="border-t border-line pt-1.5">
        <button type="submit" disabled={busy} className="btn btn-primary mt-3">
          {busy ? 'Creating…' : 'Create listing and add the details'}
          {!busy && <ArrowRight size={18} weight="bold" aria-hidden="true" />}
        </button>
      </div>
      <p className="text-[13px] leading-normal text-muted">
        Nothing is listed yet. It stays private until you list it from the editor, and there is no
        review — a toy is yours to offer or withdraw whenever you like.
      </p>
    </form>
  )
}
