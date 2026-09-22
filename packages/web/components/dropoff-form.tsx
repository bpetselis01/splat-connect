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
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarCheck,
  Camera,
  Coins,
  Drop,
  Funnel,
  Info,
  Prohibit,
  Question,
  Ruler,
  Sticker,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import {
  RECYCLING_DECLARATION,
  DECLARATION_VERSION,
  MIN_DROPOFF_GRAMS,
  estimatedCreditGrams,
} from '@splat-connect/types'

// The board's glyph for each declaration line, in RECYCLING_DECLARATION's order.
const DECL_ICONS = [Drop, Sticker, Funnel, Prohibit, Ruler, Question, Camera]
const ORG_TINTS = ['var(--tmint)', 'var(--b100)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)']

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
      <p className="card mt-[26px] p-6 text-sm leading-relaxed text-muted">
        No organisation is taking plastic right now. Each one publishes what it can take on its
        own page, so this fills up as they do.
      </p>
    )
  }

  const LABEL = 'text-sm font-extrabold text-ink'
  const left = RECYCLING_DECLARATION.length - ticked.length

  return (
    <form
      onSubmit={submit}
      className="mt-[26px] flex flex-col gap-6 rounded-card border border-line bg-[var(--surface)] p-7 shadow-[var(--e2)]"
    >
      <fieldset>
        <legend className="mb-[9px] flex w-full items-center justify-between gap-2.5">
          <span className={LABEL}>Who are you taking it to?</span>
          <span className="text-[13px] font-bold text-muted">
            {orgs.length} organisation{orgs.length === 1 ? '' : 's'}
          </span>
        </legend>
        <div role="radiogroup" aria-label="Organisation" className="grid max-h-[280px] gap-2 overflow-y-auto pr-0.5">
          {orgs.map((o, i) => {
            const on = o.id === orgId
            return (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-3 rounded-[18px] border-2 px-4 py-[13px] text-ink focus-within:outline focus-within:outline-[3px] focus-within:outline-[var(--focus)] ${
                  on ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--surface)]'
                }`}
              >
                <input
                  type="radio"
                  name="org"
                  checked={on}
                  onChange={() => pickOrg(o.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] text-[13px] font-extrabold text-[var(--tink)]"
                  style={{ background: ORG_TINTS[i % ORG_TINTS.length] }}
                >
                  {o.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-extrabold">{o.name}</span>
                  <span className="block truncate text-[13px] leading-[1.4] text-muted">
                    {[o.recycling_materials.join(', '), [o.suburb, o.state].filter(Boolean).join(' ')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
        {org?.recycling_note && (
          <p className="mt-2.5 flex items-start gap-2 rounded-[14px] bg-[var(--surface2)] px-3.5 py-[11px] text-sm leading-[1.5] text-muted">
            <Info weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-ink" />
            {org.recycling_note}
          </p>
        )}
      </fieldset>

      <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="block">
          <span className={`${LABEL} mb-[7px] block`}>How much, roughly?</span>
          <span className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="2.0"
              aria-describedby="weight-help"
              className="field !w-[110px] font-mono text-[17px] font-bold tabular-nums"
            />
            <span className="text-base font-extrabold text-muted">kg</span>
          </span>
          <span id="weight-help" className="mt-[7px] block text-[13px] leading-[1.45] text-muted">
            At least {MIN_DROPOFF_GRAMS / 1000} kg. They weigh it again at the door — this is
            just so they can plan.
          </span>
        </label>

        <fieldset>
          <legend className={`${LABEL} mb-[7px]`}>Which polymer?</legend>
          <div role="radiogroup" aria-label="Polymer" className="flex flex-wrap gap-2">
            {(org?.recycling_materials ?? []).map((m) => (
              <label
                key={m}
                className={`flex min-h-11 cursor-pointer items-center rounded-full border-2 px-[18px] text-[15px] font-extrabold text-ink focus-within:outline focus-within:outline-[3px] focus-within:outline-[var(--focus)] ${
                  material === m ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--surface)]'
                }`}
              >
                <input
                  type="radio"
                  name="material"
                  checked={material === m}
                  onChange={() => setMaterial(m)}
                  className="sr-only"
                />
                {m}
              </label>
            ))}
          </div>
          <p className="mt-[9px] text-[13px] leading-[1.45] text-muted">
            One polymer per drop. Mixed bags cannot be extruded and get sent back.
          </p>
        </fieldset>
      </div>

      <fieldset>
        <legend className="mb-2.5 flex w-full items-baseline justify-between gap-2.5">
          <span className={LABEL}>
            Your declaration <span className="text-[var(--coral)]">— all seven required</span>
          </span>
          <span className="text-[13px] font-bold text-muted" aria-live="polite">
            {ticked.length} of {RECYCLING_DECLARATION.length} ticked
          </span>
        </legend>
        <div className="grid gap-2">
          {RECYCLING_DECLARATION.map((line, i) => {
            const on = ticked.includes(line)
            const Icon = DECL_ICONS[i] ?? Drop
            return (
              <label
                key={line}
                className={`flex cursor-pointer items-center gap-3 rounded-[14px] border-2 px-[15px] py-3 ${
                  on ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--surface)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(line)}
                  className="h-[21px] w-[21px] shrink-0 cursor-pointer accent-[var(--b600)]"
                />
                <Icon weight="bold" aria-hidden="true" className="shrink-0 text-[19px] text-[var(--b600)]" />
                <span className="text-[15px] font-bold leading-[1.4]">{line}</span>
              </label>
            )
          })}
        </div>
        <p className="mt-2.5 text-[13px] leading-[1.5] text-muted">
          You are declaring the condition of the plastic, not the amount — the amount is theirs
          to measure. A batch that turns up contaminated is refused at the door and nothing is
          credited.
        </p>
      </fieldset>

      <label className="block">
        <span className={`${LABEL} mb-[7px] block`}>
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

      <div className="flex items-start gap-3.5 rounded-[18px] bg-[var(--tmint)] px-5 py-[18px] text-[var(--tink)]">
        <Coins weight="duotone" aria-hidden="true" className="shrink-0 text-[30px]" />
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[.1em] opacity-75">Worth roughly</p>
          <p className="mt-0.5 font-display text-[30px] font-extrabold leading-none tabular-nums">
            {heavyEnough && grams !== null
              ? `${estimatedCreditGrams(grams).toLocaleString('en-AU')} g`
              : '—'}
          </p>
          <p className="mt-2 text-sm leading-[1.5]">
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

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-2">
        <button type="submit" disabled={!valid || saving} className="btn btn-primary mt-4 px-[26px]">
          <CalendarCheck weight="bold" aria-hidden="true" />
          {saving ? 'Booking…' : 'Book the drop-off'}
        </button>
        <Link
          href="/get-involved/recycling"
          className="btn mt-4 min-h-[52px] border-line bg-[var(--surface)] text-ink"
        >
          Cancel
        </Link>
        <span className="mt-4 max-w-[32ch] text-[13px] leading-[1.45] text-muted">
          {valid
            ? 'Booking tells them to expect you. No credit exists until they weigh it.'
            : !heavyEnough
              ? `A drop needs to be at least ${MIN_DROPOFF_GRAMS / 1000} kg.`
              : `${left} declaration line${left === 1 ? '' : 's'} still to tick.`}
        </span>
      </div>
    </form>
  )
}
