'use client'
/**
 * Book a drop-off.
 *
 * The declaration is the real work here, and the layout says so: it is the
 * largest block on the screen and the confirm stays disabled until all seven
 * are ticked. One contaminated bag ruins a whole extruder run, and everything
 * else on this form is recoverable.
 *
 * Two numbers, deliberately separated. What a contributor types is an estimate
 * so the organisation can plan; what becomes credit is weighed at the door.
 * The "worth roughly" panel says both in as many words — a family who reads
 * 1,500 g and receives 1,100 g should have been told which number was which
 * before they filled the car, not after.
 *
 * Replaced the cut-down form on the organisation's own page, which asked one
 * condition question instead of seven and had no way to choose who to take it
 * to. That page links here with ?org= now.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: POST /:id/recycling
 * - supabase/migrations/063_recycling_declaration.sql: the versioned wording
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Recycle, Info } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import {
  RECYCLING_DECLARATION,
  DECLARATION_VERSION,
  MIN_DROPOFF_GRAMS,
  estimatedCreditGrams,
} from '@splat-connect/types'

export type DropoffOrg = {
  id: string
  name: string
  suburb: string | null
  state: string | null
  recycling_materials: string[]
  recycling_note: string | null
}

/** Kilograms as typed, in whole grams. Null for anything that is not a weight. */
export function kgToGrams(input: string): number | null {
  const match = /^\s*(\d{1,4})(?:\.(\d{1,3}))?\s*$/.exec(input)
  if (!match) return null
  const fraction = (match[2] ?? '').padEnd(3, '0')
  return Number(match[1]) * 1000 + Number(fraction)
}

export function DropoffForm({ orgs, initialOrgId }: { orgs: DropoffOrg[]; initialOrgId?: string }) {
  const router = useRouter()
  const [orgId, setOrgId] = useState(initialOrgId ?? orgs[0]?.id ?? '')
  const org = orgs.find((o) => o.id === orgId) ?? orgs[0]

  const [amount, setAmount] = useState('')
  const [material, setMaterial] = useState(org?.recycling_materials[0] ?? '')
  const [ticked, setTicked] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const grams = kgToGrams(amount)
  const allTicked = ticked.length === RECYCLING_DECLARATION.length
  const heavyEnough = grams !== null && grams >= MIN_DROPOFF_GRAMS
  const valid = !!org && material !== '' && heavyEnough && allTicked

  const toggle = (line: string) =>
    setTicked((prev) => (prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]))

  // Switching organisation can invalidate the polymer, because each publishes
  // its own list. Reset rather than silently send one they cannot take.
  function pickOrg(id: string) {
    setOrgId(id)
    const next = orgs.find((o) => o.id === id)
    setMaterial(next?.recycling_materials[0] ?? '')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || grams === null || !org) return
    setError(null)
    setSaving(true)
    try {
      await browserApiClient.post(`/api/organizations/${org.id}/recycling`, {
        material,
        estimated_grams: grams,
        condition_declared: true,
        // Which wording was on screen. See 063 — a dispute at the door is
        // exactly when somebody needs to know.
        declaration_version: DECLARATION_VERSION,
        note: note.trim(),
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not book. Try once more.')
      setSaving(false)
    }
  }

  if (orgs.length === 0) {
    return (
      <p className="card mt-6 p-6 text-sm leading-relaxed text-muted">
        No organisation is taking plastic right now. Each one publishes what it can take on its
        own page, so this fills up as they do.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      <fieldset className="card p-5">
        <legend className="px-1 font-bold text-ink">Who are you taking it to?</legend>
        <div role="radiogroup" aria-label="Organisation" className="flex flex-col gap-2">
          {orgs.map((o) => (
            <label
              key={o.id}
              className={`flex cursor-pointer items-center gap-3 rounded-card border p-3 ${
                o.id === orgId ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              <input
                type="radio"
                name="org"
                checked={o.id === orgId}
                onChange={() => pickOrg(o.id)}
              />
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-sunken text-xs font-extrabold text-brand-deep"
              >
                {o.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold text-ink">{o.name}</span>
                <span className="block truncate text-xs text-muted">
                  {[o.recycling_materials.join(', '), [o.suburb, o.state].filter(Boolean).join(' ')]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </label>
          ))}
        </div>
        {org?.recycling_note && (
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {org.recycling_note}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">How much, roughly?</span>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="2.0"
              aria-describedby="weight-help"
              className="field font-mono tabular-nums"
            />
            <span className="text-sm font-bold text-muted">kg</span>
          </div>
          <span id="weight-help" className="mt-1.5 block text-xs text-muted">
            At least {MIN_DROPOFF_GRAMS / 1000} kg. They weigh it again at the door — this is
            just so they can plan.
          </span>
        </label>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold text-ink">Which polymer?</legend>
          <div role="radiogroup" aria-label="Polymer" className="flex flex-wrap gap-2">
            {(org?.recycling_materials ?? []).map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center gap-2 rounded-pill border px-4 py-2 text-sm font-bold ${
                  material === m
                    ? 'border-brand bg-brand-tint text-brand-deep'
                    : 'border-line bg-surface text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="material"
                  checked={material === m}
                  onChange={() => setMaterial(m)}
                />
                {m}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            One polymer per drop. Mixed bags cannot be extruded and get sent back.
          </p>
        </fieldset>
      </div>

      <fieldset className="card p-5">
        <legend className="px-1 font-bold text-ink">Your declaration — all seven required</legend>
        <p className="mb-3 text-xs text-muted" aria-live="polite">
          {ticked.length} of {RECYCLING_DECLARATION.length} ticked
        </p>
        <div className="flex flex-col gap-2">
          {RECYCLING_DECLARATION.map((line) => (
            <label key={line} className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={ticked.includes(line)}
                onChange={() => toggle(line)}
                className="mt-0.5"
              />
              {line}
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          You are declaring the condition of the plastic, not the amount — the amount is theirs
          to measure. A batch that turns up contaminated is refused at the door and nothing is
          credited.
        </p>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">
          Anything they should know <span className="font-semibold text-muted">(optional)</span>
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className="field"
        />
      </label>

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <span aria-hidden="true" className="empty-badge shrink-0 text-brand-deep">
          <Recycle className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-muted">Worth roughly</p>
          <p className="font-display text-2xl font-extrabold text-ink">
            {heavyEnough && grams !== null
              ? `${estimatedCreditGrams(grams).toLocaleString('en-AU')} g`
              : '—'}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {heavyEnough
              ? `An estimate at about three quarters yield. ${org?.name} issues print credit you spend on their machines, from the weight they record.`
              : `Enter a weight of at least ${MIN_DROPOFF_GRAMS / 1000} kg to see what it is worth.`}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div>
        <button type="submit" disabled={!valid || saving} className="btn btn-primary">
          <Recycle className="h-4 w-4" aria-hidden="true" />
          {saving ? 'Booking…' : 'Book the drop-off'}
        </button>
        {!valid && (
          <p className="mt-2 text-sm text-muted">
            {!heavyEnough
              ? `A drop needs to be at least ${MIN_DROPOFF_GRAMS / 1000} kg.`
              : `${RECYCLING_DECLARATION.length - ticked.length} declaration line${
                  RECYCLING_DECLARATION.length - ticked.length === 1 ? '' : 's'
                } still to tick.`}
          </p>
        )}
      </div>
    </form>
  )
}
