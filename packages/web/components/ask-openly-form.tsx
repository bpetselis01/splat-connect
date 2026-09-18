'use client'
/**
 * Post a build request to the Makers wanted board.
 *
 * Four fields and a note, and the four are the four a maker scrolling the board
 * decides by: which guide, who it is for, where you are, how far you can get.
 * Everything else is agreed in the thread once somebody claims it — the same
 * rule every other request on SPLAT follows.
 *
 * The suburb and the travel range are required here and optional on the
 * addressed version of this form, because an open request has nobody to ask. A
 * card that cannot say "Family in Newtown · can travel 10 km" is a card no
 * maker can act on.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Hammer } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

/** The ranges the board filters by, so a family picks one it can be found under. */
const RANGES = [5, 10, 15, 25, 50]

const URGENCIES = ['No rush', 'Before school holidays', 'Within a month', 'As soon as someone can']

export function AskOpenlyForm({
  tutorials,
  initialGuide,
}: {
  tutorials: Array<{ id: string; title: string }>
  initialGuide?: string
}) {
  const router = useRouter()
  const [tutorialId, setTutorialId] = useState(initialGuide ?? '')
  const [childLabel, setChildLabel] = useState('')
  const [suburb, setSuburb] = useState('')
  const [travelKm, setTravelKm] = useState(10)
  const [urgency, setUrgency] = useState(URGENCIES[0])
  const [hasToy, setHasToy] = useState(false)
  const [brief, setBrief] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const ready = tutorialId && suburb.trim() && brief.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready) return
    setError(null)
    setSaving(true)
    try {
      const tx = await browserApiClient.post<{ id: string }>('/api/toy-transactions/build', {
        tutorial_id: tutorialId,
        build_brief: brief.trim(),
        child_label: childLabel.trim(),
        requester_suburb: suburb.trim(),
        travel_km: travelKm,
        urgency,
        family_has_toy: hasToy,
        // No maker_id and no maker_org_id: that is what makes it open.
      })
      router.push(`/dashboard/exchanges/build/${tx.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not post. Try once more.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Which guide?</span>
        <select
          value={tutorialId}
          onChange={(e) => setTutorialId(e.target.value)}
          className="field"
        >
          <option value="">Choose a published guide</option>
          {tutorials.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-muted">
          Published guides only, so the ask is specific.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">
            Who is it for? <span className="font-semibold text-muted">(optional)</span>
          </span>
          <input
            value={childLabel}
            onChange={(e) => setChildLabel(e.target.value)}
            maxLength={60}
            placeholder="Leo, 3"
            className="field"
          />
          {/* Said where the decision is made, not in a policy page. */}
          <span className="mt-1.5 block text-xs text-muted">
            A first name and an age is plenty. This goes on a public board.
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Your suburb</span>
          <input
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            maxLength={80}
            placeholder="Newtown"
            className="field"
          />
          <span className="mt-1.5 block text-xs text-muted">
            The suburb only — never your address.
          </span>
        </label>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink">How far can you travel?</legend>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((km) => (
            <button
              key={km}
              type="button"
              onClick={() => setTravelKm(km)}
              aria-pressed={travelKm === km}
              className="chip"
            >
              {km} km
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">When do you need it?</span>
        <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="field">
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={hasToy}
          onChange={(e) => setHasToy(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          We already own the toy
          <span className="block text-xs text-muted">
            It changes what a maker is agreeing to: buying one, or adapting yours.
          </span>
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Anything else?</span>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Leo lights up at bubbles but I do not own a soldering iron and would not know where to start."
          className="field"
        />
        <span className="mt-1.5 block text-xs text-muted">
          The only free text on the card. Everything else is agreed in the thread once somebody
          claims it.
        </span>
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={!ready || saving} className="btn btn-primary">
          <Hammer className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Posting…' : 'Post to Makers wanted'}
        </button>
        <p className="mt-2 text-sm text-muted">
          The family covers the parts — most builds are under $35. The maker gives the time.
        </p>
      </div>
    </form>
  )
}
