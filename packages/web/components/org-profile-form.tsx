'use client'

/**
 * The organisation profile editor.
 *
 * Every field on the public organisation page has an input here — identity, the
 * About paragraph, the capability chips, the declared rates, and how a family
 * reaches you. That is the artboard's requirement and the reason the form is
 * long: a public page with a field nobody can edit is a field that goes stale.
 *
 * There is no review. It publishes on save, which is why the leader terms are
 * restated at the foot rather than assumed — the same rule the events and
 * stories editor follows.
 *
 * The pickup address is deliberately NOT here. It is private (033 revoked its
 * grant for exactly that reason) and has its own route; putting it on this form
 * would leave a private column one typo away from a public response.
 */
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChartBar,
  Check,
  Eye,
  EyeSlash,
  Gift,
  Printer,
  Recycle,
  SealCheck,
  UsersThree,
  Wrench,
} from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { AU_STATES, ORG_CAPABILITIES, PRINT_MATERIALS } from '@splat-connect/types'
import type { Organization, OrgCapability } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

// What each capability promises a family, in the board's words where the board
// has a row for it. "Builds adaptations" has no board row; its line says only
// what the chip already claims.
const CAPABILITY: Record<OrgCapability, { icon: Icon; sub: string }> = {
  'Backs guides': {
    icon: SealCheck,
    sub: 'A leader here reads a guide and vouches for it. This is the claim that carries the risk.',
  },
  'Holds toys': {
    icon: Gift,
    sub: 'You hold a shelf of adapted toys local families can borrow or be given.',
  },
  'Builds adaptations': { icon: Wrench, sub: 'You adapt toys for families who ask.' },
  'Has a printer': { icon: Printer, sub: 'Your machines print STL parts for families who ask.' },
  'Takes recycling': {
    icon: Recycle,
    sub: 'You accept waste-plastic drop-offs, weigh them and issue filament credit.',
  },
  'Runs build days': {
    icon: UsersThree,
    sub: 'You host adaptation sessions families can book a place at.',
  },
}

export function OrgProfileForm({ org }: { org: Organization }) {
  const router = useRouter()
  const [capabilities, setCapabilities] = useState<string[]>(org.capabilities ?? [])
  const [materials, setMaterials] = useState<string[]>(org.recycling_materials ?? [])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggle(list: string[], set: (next: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/organizations/${org.id}/profile`, {
          name: String(form.get('name') ?? '').trim(),
          description: String(form.get('description') ?? ''),
          about: String(form.get('about') ?? ''),
          suburb: String(form.get('suburb') ?? ''),
          state: String(form.get('state') ?? ''),
          contact_email: String(form.get('contact_email') ?? ''),
          contact_phone: String(form.get('contact_phone') ?? ''),
          website_url: String(form.get('website_url') ?? ''),
          rate_note: String(form.get('rate_note') ?? ''),
          recycling_note: String(form.get('recycling_note') ?? ''),
          capabilities,
          recycling_materials: materials,
        })
        setSaved(true)
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setError(detail ?? 'That did not save. Check your connection and try again.')
      }
    })
  }

  // A state saved before this was a dropdown stays selectable rather than
  // being silently replaced on the next save.
  const states: string[] =
    org.state && !(AU_STATES as readonly string[]).includes(org.state)
      ? [...AU_STATES, org.state]
      : [...AU_STATES]

  return (
    <form className="mt-7 flex flex-col gap-5" onSubmit={submit}>
      <section className="edit-card">
        <h2 className="edit-card__title">Identity</h2>
        <label>
          <span className="form-label">Organisation name</span>
          <input name="name" defaultValue={org.name} className="field" maxLength={120} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_92px_110px]">
          <label>
            <span className="form-label">Suburb</span>
            <input name="suburb" defaultValue={org.suburb ?? ''} className="field" maxLength={80} />
          </label>
          <label>
            <span className="form-label">State</span>
            <select name="state" defaultValue={org.state ?? ''} className="field px-2.5 font-bold">
              <option value="">—</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          {/* Counted from the row, not typed: it is the year the organisation
              was approved onto SPLAT. */}
          <label>
            <span className="form-label">On SPLAT since</span>
            <input
              readOnly
              value={new Date(org.created_at).getFullYear()}
              className="field text-center font-mono font-semibold"
            />
          </label>
        </div>
        <label>
          <span className="form-label">One line, for the badge on a guide</span>
          <input
            name="description"
            defaultValue={org.description ?? ''}
            className="field"
            maxLength={500}
          />
        </label>
        <p className="text-[13px] leading-normal text-muted">
          The suburb is public. A street address is only ever shown to someone you have accepted,
          and only from your pickup point.
        </p>
      </section>

      <section className="edit-card">
        <h2 className="edit-card__title">About</h2>
        <label>
          <span className="form-label">The paragraph at the top of your page</span>
          <textarea
            name="about"
            defaultValue={org.about ?? ''}
            rows={4}
            maxLength={4000}
            className="field"
            placeholder="What you do, who you do it for, and how a family starts."
          />
          <span className="mt-2 block text-[13px] text-muted">
            Say what you actually do and who can walk in. A family reads this before they decide to
            ask.
          </span>
        </label>
        <div className="flex items-start gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--b50)] px-4 py-3.5">
          <ChartBar weight="duotone" aria-hidden="true" className="flex-none text-[22px] text-[var(--b600)]" />
          <p className="text-sm leading-normal text-muted">
            <strong className="text-ink">The four numbers under it are counted, not typed:</strong>{' '}
            guides backed, guides reviewed, toys on the shelf and toys delivered all come from what
            has actually happened here.
          </p>
        </div>
      </section>

      <section className="edit-card gap-3.5">
        <div>
          <h2 className="edit-card__title">What you do</h2>
          <p className="edit-card__lede">
            Each one you switch on becomes a chip on your public page. Switch it off and the chip
            goes — nothing already in progress is affected.
          </p>
        </div>
        <ul className="flex flex-col gap-2.5">
          {ORG_CAPABILITIES.map((capability) => {
            const on = capabilities.includes(capability)
            const { icon: CapIcon, sub } = CAPABILITY[capability]
            return (
              <li key={capability}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => toggle(capabilities, setCapabilities, capability)}
                  className={`flex w-full items-center gap-3.5 rounded-[18px] border-2 px-4 py-3.5 text-left text-ink transition-colors hover:border-brand focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
                    on ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--canvas)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-surface text-2xl text-[var(--b600)] shadow-[var(--e1)]"
                  >
                    <CapIcon weight="duotone" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-base font-extrabold">{capability}</span>
                    <span className="text-[13px] leading-[1.45] text-muted">{sub}</span>
                  </span>
                  <span
                    className={`badge flex-none px-3 py-[5px] ${
                      on ? 'bg-[var(--tok)] text-[var(--tink)]' : 'bg-sunken text-muted'
                    }`}
                  >
                    {on ? <Eye weight="fill" aria-hidden="true" /> : <EyeSlash weight="fill" aria-hidden="true" />}
                    {on ? 'On your profile' : 'Hidden'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="edit-card">
        <div>
          <h2 className="edit-card__title">What you ask families to cover</h2>
          {/* The board's own line under this panel. Kept although live has no
              itemised cost lines to put it beside: it is the money disclaimer,
              and this is the only screen where a leader states a price. */}
          <p className="edit-card__lede">
            SPLAT does not take payments or a cut. This is a written record both of you can see —
            you settle it between yourselves.
          </p>
        </div>
        <label>
          <span className="form-label">What you quote families</span>
          <textarea
            name="rate_note"
            defaultValue={org.rate_note ?? ''}
            rows={3}
            maxLength={500}
            className="field"
            placeholder="Parts at cost, no charge for labour."
          />
        </label>
      </section>

      <section className="edit-card">
        <div>
          <h2 className="edit-card__title">Recycling you can take</h2>
          <p className="edit-card__lede">
            Leave this empty if you do not take drop-offs — the booking form only appears when there
            is something on this list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRINT_MATERIALS.map((material) => (
            <label key={material} className="toggle-pill">
              <input
                type="checkbox"
                checked={materials.includes(material)}
                onChange={() => toggle(materials, setMaterials, material)}
                className="sr-only"
              />
              {material}
            </label>
          ))}
        </div>
        <label>
          <span className="form-label">How you want it brought</span>
          <textarea
            name="recycling_note"
            defaultValue={org.recycling_note ?? ''}
            rows={3}
            maxLength={500}
            className="field"
            placeholder="Clean, dry, sorted by colour. Two-kilo minimum."
          />
        </label>
      </section>

      <section className="edit-card">
        <h2 className="edit-card__title">How a family reaches you</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="form-label">Public email</span>
            <input
              name="contact_email"
              type="email"
              defaultValue={org.contact_email ?? ''}
              className="field"
              maxLength={200}
            />
          </label>
          <label>
            <span className="form-label">
              Phone <span>(optional)</span>
            </span>
            <input
              name="contact_phone"
              defaultValue={org.contact_phone ?? ''}
              className="field"
              maxLength={40}
            />
          </label>
        </div>
        <label>
          <span className="form-label">
            Website <span>(optional)</span>
          </span>
          <input
            name="website_url"
            defaultValue={org.website_url ?? ''}
            className="field"
            maxLength={300}
            placeholder="https://"
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="alert bg-mint-soft text-ink">
          Saved — your public page has changed.
        </p>
      )}

      {/* Restated because there is no review: what a leader saves is live the
          moment they save it. */}
      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--b50)] px-5 py-[18px]">
        <button type="submit" className="btn btn-primary px-[26px]" disabled={pending}>
          <Check weight="bold" aria-hidden="true" />
          Save and publish
        </button>
        <Link href={`/organizations/${org.id}/public`} className="btn btn-quiet min-h-[52px]">
          <Eye aria-hidden="true" />
          View public profile
        </Link>
        <p className="min-w-60 flex-1 text-[13px] leading-normal text-muted">
          No review — this is your own page, so it goes live on save. What you claim here you stand
          behind: the{' '}
          <a href="/legal/org-leader-terms" className="font-extrabold">
            organisation leader terms
          </a>{' '}
          apply to every capability you switch on.
        </p>
      </div>
    </form>
  )
}
