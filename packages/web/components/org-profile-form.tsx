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
import { useRouter } from 'next/navigation'
import { ORG_CAPABILITIES, PRINT_MATERIALS } from '@splat-connect/types'
import type { Organization } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

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

  return (
    <form className="card flex flex-col gap-5 p-6" onSubmit={submit}>
      <label>
        <span className="field-label">Name</span>
        <input name="name" defaultValue={org.name} className="field mt-1 w-full" maxLength={120} />
      </label>

      <label>
        <span className="field-label">One line, for the badge on a guide</span>
        <input
          name="description"
          defaultValue={org.description ?? ''}
          className="field mt-1 w-full"
          maxLength={500}
        />
      </label>

      <label>
        <span className="field-label">About</span>
        <textarea
          name="about"
          defaultValue={org.about ?? ''}
          rows={6}
          maxLength={4000}
          className="field mt-1 w-full"
          placeholder="What you do, who you do it for, and how a family starts."
        />
      </label>

      <fieldset>
        <legend className="field-label">What you do</legend>
        <p className="mt-1 text-[13px] text-muted">These show as chips on your public page.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {ORG_CAPABILITIES.map((capability) => (
            <label key={capability} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={capabilities.includes(capability)}
                onChange={() => toggle(capabilities, setCapabilities, capability)}
              />
              {capability}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <label className="w-44">
          <span className="field-label">Suburb</span>
          <input
            name="suburb"
            defaultValue={org.suburb ?? ''}
            className="field mt-1 w-full"
            maxLength={80}
          />
        </label>
        <label className="w-28">
          <span className="field-label">State</span>
          <input
            name="state"
            defaultValue={org.state ?? ''}
            className="field mt-1 w-full"
            maxLength={20}
          />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="field-label">How a family reaches you</legend>
        <input
          name="contact_email"
          type="email"
          defaultValue={org.contact_email ?? ''}
          className="field w-full"
          maxLength={200}
          placeholder="Email"
        />
        <input
          name="contact_phone"
          defaultValue={org.contact_phone ?? ''}
          className="field w-full"
          maxLength={40}
          placeholder="Phone"
        />
        <input
          name="website_url"
          defaultValue={org.website_url ?? ''}
          className="field w-full"
          maxLength={300}
          placeholder="Website"
        />
      </fieldset>

      <label>
        <span className="field-label">What you quote families</span>
        <textarea
          name="rate_note"
          defaultValue={org.rate_note ?? ''}
          rows={3}
          maxLength={500}
          className="field mt-1 w-full"
          placeholder="Parts at cost, no charge for labour."
        />
      </label>

      <fieldset>
        <legend className="field-label">Recycling you can take</legend>
        <p className="mt-1 text-[13px] text-muted">
          Leave this empty if you do not take drop-offs — the booking form only appears when there
          is something on this list.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {PRINT_MATERIALS.map((material) => (
            <label key={material} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={materials.includes(material)}
                onChange={() => toggle(materials, setMaterials, material)}
              />
              {material}
            </label>
          ))}
        </div>
        {/* Its own label rather than leaning on the legend: a legend names the
            group, and a textarea inside one has no accessible name of its own. */}
        <label className="mt-3 block">
          <span className="field-label">How you want it brought</span>
          <textarea
            name="recycling_note"
            defaultValue={org.recycling_note ?? ''}
            rows={3}
            maxLength={500}
            className="field mt-1 w-full"
            placeholder="Clean, dry, sorted by colour. Two-kilo minimum."
          />
        </label>
      </fieldset>

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
      <p className="text-[13px] leading-relaxed text-muted">
        Nothing here is reviewed. Saving publishes it, and the{' '}
        <a href="/legal/org-leader-terms">organisation leader terms</a> are what you are standing
        behind when you do.
      </p>

      <button type="submit" className="btn btn-primary self-start" disabled={pending}>
        Save and publish
      </button>
    </form>
  )
}
