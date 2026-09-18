'use client'

/**
 * Adding a printer.
 *
 * Bed size and materials are not decoration: they are the fit check a request
 * runs before it is offered to the machine, which is why they are required and
 * why the copy says what they are for.
 *
 * Availability is two fields on purpose — the toggle is the deliberate act and
 * the capacity is the honest one. Either closes you, and the form says so
 * rather than leaving somebody to discover it.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PRINT_MATERIALS } from '@splat-connect/types'
import type { Organization } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function PrinterForm({ ledOrgs }: { ledOrgs: Pick<Organization, 'id' | 'name'>[] }) {
  const router = useRouter()
  const [materials, setMaterials] = useState<string[]>(['PLA'])
  const [ownerOrgId, setOwnerOrgId] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    if (!name || materials.length === 0) return

    setError(null)
    startTransition(async () => {
      try {
        await browserApiClient.post('/api/printers', {
          name,
          materials,
          bed_x: Number(form.get('bed_x')),
          bed_y: Number(form.get('bed_y')),
          bed_z: Number(form.get('bed_z')),
          suburb: String(form.get('suburb') ?? '').trim(),
          state: String(form.get('state') ?? '').trim(),
          capacity: Number(form.get('capacity')),
          accepting: form.get('accepting') === 'on',
          notes: String(form.get('notes') ?? '').trim(),
          ...(ownerOrgId ? { owner_org_id: ownerOrgId } : {}),
        })
        router.push('/dashboard/printers')
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
        <input name="name" className="field mt-1 w-full" maxLength={80} placeholder="Prusa MK4" />
      </label>

      {ledOrgs.length > 0 && (
        <label>
          <span className="field-label">Whose machine</span>
          <select
            className="field mt-1 w-full"
            value={ownerOrgId}
            onChange={(e) => setOwnerOrgId(e.target.value)}
          >
            <option value="">Mine</option>
            {ledOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <fieldset>
        <legend className="field-label">Materials loaded</legend>
        <p className="mt-1 text-[13px] text-muted">
          These decide which requests you are offered.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {PRINT_MATERIALS.map((material) => (
            <label key={material} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={materials.includes(material)}
                onChange={() =>
                  setMaterials((prev) =>
                    prev.includes(material)
                      ? prev.filter((m) => m !== material)
                      : [...prev, material]
                  )
                }
              />
              {material}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label">Bed size, in millimetres</legend>
        <p className="mt-1 text-[13px] text-muted">
          A part that does not fit the bed cannot be printed, so this is the first thing a request
          is checked against.
        </p>
        <div className="mt-2 flex gap-3">
          {(['bed_x', 'bed_y', 'bed_z'] as const).map((axis, i) => (
            <label key={axis} className="w-24">
              <span className="block text-[13px] font-bold text-muted">{'XYZ'[i]}</span>
              <input
                name={axis}
                type="number"
                min={1}
                max={2000}
                defaultValue={250}
                className="field mt-1 w-full font-mono tabular-nums"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <label className="w-40">
          <span className="field-label">Suburb</span>
          <input name="suburb" className="field mt-1 w-full" maxLength={60} />
        </label>
        <label className="w-28">
          <span className="field-label">State</span>
          <input name="state" className="field mt-1 w-full" maxLength={10} />
        </label>
      </div>

      <fieldset>
        <legend className="field-label">Availability</legend>
        <p className="mt-1 text-[13px] text-muted">
          Either of these closes you: untick the toggle, or set the number of jobs you will carry at
          once.
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input name="accepting" type="checkbox" defaultChecked />
            Taking new jobs
          </label>
          <label className="w-32">
            <span className="block text-[13px] font-bold text-muted">Jobs at once</span>
            <input
              name="capacity"
              type="number"
              min={0}
              max={20}
              defaultValue={1}
              className="field mt-1 w-full font-mono tabular-nums"
            />
          </label>
        </div>
      </fieldset>

      <label>
        <span className="field-label">Anything else</span>
        <textarea name="notes" className="field mt-1 w-full" rows={3} maxLength={500} />
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary self-start" disabled={pending}>
        Add the printer
      </button>
    </form>
  )
}
