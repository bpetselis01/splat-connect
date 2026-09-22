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
 *
 * Laid out as the board's #mw_new: a searchable guide picker that collapses to
 * the chosen guide, then one card of questions. The board also asks how the
 * toy reaches the maker and quotes a parts cost; neither is stored anywhere
 * yet, so neither is drawn.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  BookOpen,
  Clock,
  Hammer,
  MagnifyingGlass,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
} from '@phosphor-icons/react/dist/ssr'
import { formatBuildTime, KIND_LABEL, type Difficulty, type TutorialKind } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

/** The ranges the board filters by, so a family picks one it can be found under. */
const RANGES = [5, 10, 15, 25, 50]

const URGENCIES = ['No rush', 'Before school holidays', 'Within a month', 'As soon as someone can']

export type AskGuide = {
  id: string
  title: string
  difficulty: Difficulty
  kind: TutorialKind
  build_minutes: number | null
}

const DIFF: Record<Difficulty, { label: string; tint: string }> = {
  easy: { label: 'Easy', tint: 'var(--tmint)' },
  medium: { label: 'Medium', tint: 'var(--tamber)' },
  hard: { label: 'Hard', tint: 'var(--tcoral)' },
}

const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'toy_adaptation', label: 'Toy' },
  { id: 'assistive_tech', label: 'Assistive tech' },
  { id: 'easy', label: 'Easy only' },
] as const

const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const HINT = 'mt-1.5 block text-[13px] text-muted'
const CHIP = 'min-h-11 rounded-full border px-4 text-sm font-bold text-ink hover:border-brand'
const chipTone = (on: boolean) =>
  on ? 'border-[var(--b600)] bg-[var(--b100)]' : 'border-line bg-[var(--surface)]'

function GuideTile({ g, size }: { g: AskGuide; size: 44 | 64 }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center ${size === 64 ? 'h-16 w-16 rounded-[18px]' : 'h-11 w-11 rounded-[14px]'}`}
      style={{ background: DIFF[g.difficulty].tint }}
    >
      <BookOpen weight="duotone" className={`${size === 64 ? 'text-[32px]' : 'text-[22px]'} text-[var(--tink)] opacity-75`} />
    </span>
  )
}

export function AskOpenlyForm({
  tutorials,
  initialGuide,
}: {
  tutorials: AskGuide[]
  initialGuide?: string
}) {
  const router = useRouter()
  const [tutorialId, setTutorialId] = useState(initialGuide ?? '')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('all')
  const [childLabel, setChildLabel] = useState('')
  const [suburb, setSuburb] = useState('')
  const [travelKm, setTravelKm] = useState(10)
  const [urgency, setUrgency] = useState(URGENCIES[0])
  const [hasToy, setHasToy] = useState(false)
  const [brief, setBrief] = useState('')
  const [covers, setCovers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const picked = tutorials.find((t) => t.id === tutorialId)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tutorials.filter(
      (t) =>
        (kind === 'all' || (kind === 'easy' ? t.difficulty === 'easy' : t.kind === kind)) &&
        (!q || t.title.toLowerCase().includes(q))
    )
  }, [tutorials, query, kind])

  const ready = tutorialId && suburb.trim() && brief.trim() && covers

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
    <form onSubmit={submit} className="mt-[26px] flex flex-col gap-5">
      <div>
        <span id="ask-guide" className={`${LABEL} mb-[9px]`}>
          Which guide?
        </span>
        {picked ? (
          <div className="flex items-center gap-3.5 rounded-[18px] border-2 border-[var(--b600)] bg-[var(--b50)] px-4 py-3.5">
            <GuideTile g={picked} size={64} />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-extrabold leading-[1.3]">{picked.title}</span>
              <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-extrabold">
                <span className="rounded-full px-2.5 py-[3px] text-[var(--tink)]" style={{ background: DIFF[picked.difficulty].tint }}>
                  {DIFF[picked.difficulty].label}
                </span>
                {picked.build_minutes && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface2)] px-2.5 py-[3px]">
                    <Clock aria-hidden="true" /> {formatBuildTime(picked.build_minutes)}
                  </span>
                )}
                <span className="rounded-full bg-[var(--surface2)] px-2.5 py-[3px]">{KIND_LABEL[picked.kind]}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setTutorialId('')}
              className="min-h-11 shrink-0 rounded-full border border-line bg-[var(--surface)] px-4 text-sm font-extrabold text-ink hover:bg-[var(--surface2)]"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-line bg-[var(--surface)] shadow-[var(--e2)]">
            <div className="flex items-center gap-2.5 border-b border-line bg-[var(--canvas)] px-3.5 py-3">
              <MagnifyingGlass weight="bold" aria-hidden="true" className="shrink-0 text-lg text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-labelledby="ask-guide"
                aria-controls="ask-guide-results"
                placeholder="Search by toy, switch type or guide name"
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-ink outline-none"
              />
              <span className="shrink-0 text-[13px] font-bold text-muted">
                {results.length} {results.length === 1 ? 'guide' : 'guides'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-line px-3.5 py-2.5">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`min-h-9 rounded-full border px-3 text-[13px] font-bold text-ink hover:border-brand ${chipTone(kind === k.id)}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <ul id="ask-guide-results" className="m-0 flex max-h-[360px] list-none flex-col gap-0.5 overflow-auto p-1.5">
              {results.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setTutorialId(g.id)}
                    className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-ink hover:bg-[var(--surface2)]"
                  >
                    <GuideTile g={g} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-extrabold leading-[1.3]">{g.title}</span>
                      <span className="mt-0.5 block text-[13px] font-bold text-muted">
                        {[KIND_LABEL[g.kind], DIFF[g.difficulty].label, g.build_minutes && formatBuildTime(g.build_minutes)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <Plus weight="bold" aria-hidden="true" className="shrink-0 text-base text-[var(--b700)]" />
                  </button>
                </li>
              ))}
            </ul>
            {results.length === 0 && (
              <p className="p-[22px] text-center text-sm text-muted">
                No published guide matches that. If it does not exist yet,{' '}
                <Link href="/get-involved/submit-an-idea" className="font-extrabold">
                  submit an idea
                </Link>{' '}
                instead.
              </p>
            )}
          </div>
        )}
        <p className="mt-2 text-[13px] text-muted">
          Only published guides can be asked for. Need something that does not exist yet?{' '}
          <Link href="/get-involved/submit-an-idea" className="font-extrabold">
            Submit an idea
          </Link>{' '}
          instead.
        </p>
      </div>

      <div className="card flex flex-col gap-4 p-[22px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>
              Who is it for? <span className="font-semibold text-muted">(optional)</span>
            </span>
            <input
              value={childLabel}
              onChange={(e) => setChildLabel(e.target.value)}
              maxLength={60}
              placeholder="e.g. Leo, 3 — uses a 100 mm button switch"
              className="field"
            />
            {/* Said where the decision is made, not in a policy page. */}
            <span className={HINT}>First name and age is plenty. This goes on a public board.</span>
          </label>
          <label className="block">
            <span className={LABEL}>Your suburb</span>
            <input
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              maxLength={80}
              placeholder="Newtown"
              className="field"
            />
            <span className={HINT}>The suburb only — never your address.</span>
          </label>
        </div>

        <fieldset>
          <legend className={`${LABEL} mb-[9px]`}>Do you already have the toy?</legend>
          <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-2">
            {[
              { v: false, icon: ShoppingCart, label: 'No, the maker sources it', sub: 'The maker buys the toy and the parts. Most guides name a cheap, easy-to-find toy.' },
              { v: true, icon: Package, label: 'Yes, it just needs adapting', sub: 'You hand your toy to the maker, they add the switch jack and hand it back.' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={hasToy === o.v}
                onClick={() => setHasToy(o.v)}
                className={`flex items-start gap-3 rounded-[18px] border-2 px-4 py-3.5 text-left text-ink hover:border-brand ${
                  hasToy === o.v ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--surface)]'
                }`}
              >
                <o.icon weight="duotone" aria-hidden="true" className="shrink-0 text-[26px] text-[var(--b600)]" />
                <span>
                  <span className="block text-[15px] font-extrabold">{o.label}</span>
                  <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted">{o.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className={LABEL}>A note to the maker</span>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Why this toy, anything about the switch you already have, what would make handover easy"
            className="field"
          />
          <span className={HINT}>
            The only free text on the card. Everything else is agreed in the thread once somebody
            claims it.
          </span>
        </label>

        <fieldset>
          <legend className={`${LABEL} mb-[9px]`}>How far can you travel to collect?</legend>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => setTravelKm(km)}
                aria-pressed={travelKm === km}
                className={`${CHIP} ${chipTone(travelKm === km)}`}
              >
                {km} km
              </button>
            ))}
          </div>
          <span className={HINT}>Makers further than this will not see the request.</span>
        </fieldset>

        <fieldset>
          <legend className={`${LABEL} mb-[9px]`}>How soon?</legend>
          <div className="flex flex-wrap gap-2">
            {URGENCIES.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                aria-pressed={urgency === u}
                className={`${CHIP} ${chipTone(urgency === u)}`}
              >
                {u}
              </button>
            ))}
          </div>
        </fieldset>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-[18px] border-2 px-4 py-3.5 ${
            covers ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-[var(--surface2)]'
          }`}
        >
          <input
            type="checkbox"
            checked={covers}
            onChange={(e) => setCovers(e.target.checked)}
            className="mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer accent-[var(--b600)]"
          />
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold">
              {hasToy ? 'You cover the parts' : 'You cover the toy and parts'}
            </span>
            <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted">
              The maker gives the time and the skill — they never pay for your build. You settle
              the receipt with them in the thread; SPLAT never handles money. Tick this before you
              post.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-start gap-3.5 rounded-[18px] border border-line bg-[var(--b100)] px-5 py-[18px]">
        <ShieldCheck weight="duotone" aria-hidden="true" className="shrink-0 text-[28px] text-[var(--b600)]" />
        <p className="text-sm leading-[1.55] text-[var(--tink)]">
          Makers on SPLAT build to a published, reviewed guide, and you approve a photo of it
          working before you meet. Meet somewhere public — a library or clinic — and use the
          handover code like any toy exchange.
        </p>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!ready || saving} className="btn btn-primary px-7">
          <Hammer weight="bold" aria-hidden="true" />
          {saving ? 'Posting…' : 'Post to Makers wanted'}
        </button>
        <Link
          href="/get-involved/makers-wanted"
          className="btn min-h-[52px] border-line bg-[var(--surface)] text-ink"
        >
          Cancel
        </Link>
        <span className="text-[13px] font-semibold text-muted">
          You can withdraw it any time before a maker claims it.
        </span>
      </div>
    </form>
  )
}
