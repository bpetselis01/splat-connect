'use client'
/**
 * The printer directory under /printing's hero: a filter rail beside a grid of
 * machines, in the browse shape /library and /toy-library use.
 *
 * The board's rail has five facets. Three are here, because three are things a
 * printer row stores: whether it is taking jobs, which filaments it holds, and
 * whether a person or an organisation runs it. "Distance from you" and
 * "Verified only" need a requester location and a verified flag the API does
 * not return, and a facet that filters on nothing is worse than no facet.
 *
 * Browsing only. A request is sent from a guide (/printing/requests?guide=…),
 * so the cards carry no Pick button — the pick-up-to-three choice is made on
 * that form, where the guide is known, not in a tray here that would have to
 * carry picks through a guide and back.
 */
import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Lightning,
  Eye,
  Cube,
  UsersThree,
  User,
  Buildings,
  MapPin,
  Printer as PrinterIcon,
  PauseCircle,
  MoonStars,
  X,
  MagnifyingGlass,
} from '@phosphor-icons/react/dist/ssr'
import type { PrinterWithOwner } from '@splat-connect/types'
import { filamentRate } from '@/lib/filament-rate'

type Filters = {
  avail?: 'open' | 'noq' | 'any'
  mat?: string
  who?: 'person' | 'org'
}

const FACETS = [
  {
    key: 'avail',
    label: 'Availability',
    icon: CheckCircle,
    opts: [
      ['open', 'Open now', CheckCircle],
      ['noq', 'No queue', Lightning],
      ['any', 'Show paused too', Eye],
    ],
  },
  {
    key: 'mat',
    label: 'Material on hand',
    icon: Cube,
    opts: [
      ['PETG', 'PETG', Cube],
      ['PLA', 'PLA', Cube],
      ['TPU', 'TPU', Cube],
    ],
  },
  {
    key: 'who',
    label: 'Who is printing',
    icon: UsersThree,
    opts: [
      ['person', 'A person', User],
      ['org', 'An organisation', Buildings],
    ],
  },
] as const

// The board's card tints, rotated so a row of three never repeats one.
const TINTS = ['var(--tmint)', 'var(--b100)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)']

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

const isOpen = (p: PrinterWithOwner) => p.accepting && p.open_jobs < p.capacity

export function matches(p: PrinterWithOwner, f: Filters) {
  if (f.avail === 'open' && !isOpen(p)) return false
  if (f.avail === 'noq' && !(isOpen(p) && p.open_jobs === 0)) return false
  if (f.mat && !p.materials.includes(f.mat)) return false
  if (f.who === 'org' && !p.owner_org_id) return false
  if (f.who === 'person' && p.owner_org_id) return false
  return true
}

export function PrinterDirectory({
  printers,
  gate,
}: {
  /** Null for a guest: /api/printers needs a session. */
  printers: PrinterWithOwner[] | null
  /** What stands in the grid's place when `printers` is null. */
  gate: React.ReactNode
}) {
  const [filters, setFilters] = useState<Filters>({})

  function toggle(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: f[key] === value ? undefined : value }))
  }

  const shown = (printers ?? []).filter((p) => matches(p, filters))
  const chips = FACETS.flatMap((facet) =>
    facet.opts
      .filter(([v]) => filters[facet.key] === v)
      .map(([v, label]) => ({ label, clear: () => toggle(facet.key, v) }))
  )

  return (
    <div className="browse-layout">
      <aside aria-label="Filters" className="browse-filters">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold text-ink">Filters</h2>
          <button
            type="button"
            onClick={() => setFilters({})}
            className="min-h-9 text-sm font-bold text-brand-deep"
          >
            Clear
          </button>
        </div>

        {FACETS.map((facet) => (
          <fieldset key={facet.key}>
            <legend>
              <facet.icon
                size={18}
                weight="duotone"
                className="text-brand-dark"
                aria-hidden="true"
              />
              {facet.label}
            </legend>
            <div className="flex flex-wrap gap-2">
              {facet.opts.map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filters[facet.key] === value}
                  onClick={() => toggle(facet.key, value)}
                  className="chip gap-1.5"
                >
                  <Icon size={14} weight="bold" className="text-brand-dark" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        ))}

        <p className="browse-note bg-honey-soft">
          <MapPin size={26} weight="duotone" className="flex-none" aria-hidden="true" />
          <span>
            <strong className="font-extrabold">No printer near you?</strong> Ask, and someone may
            print it and post it to you.{' '}
            <Link href="/get-involved" className="font-extrabold underline">
              Ask for a print →
            </Link>
          </span>
        </p>
        <p className="browse-note bg-mint-soft">
          <PrinterIcon size={26} weight="duotone" className="flex-none" aria-hidden="true" />
          <span>
            <strong className="font-extrabold">Own a printer?</strong> List it and take requests
            when it suits you.{' '}
            <Link href="/dashboard/printers/new" className="font-extrabold underline">
              Add a printer →
            </Link>
          </span>
        </p>
      </aside>

      <div className="min-w-0">
        <div className="browse-head">
          <div>
            <h2>Printers near you</h2>
            <p className="mt-1 text-[15px] text-muted">
              Open a guide to ask up to three of them. The first to accept takes the job; the others step back automatically.
            </p>
          </div>
          {printers && (
            <span aria-live="polite" className="text-sm font-bold text-muted">
              {shown.length} printer{shown.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {chips.length > 0 && (
          <div className="mb-5 flex min-h-9 flex-wrap gap-2">
            {chips.map((chip) => (
              <button key={chip.label} type="button" onClick={chip.clear} className="browse-chip">
                {chip.label}
                <X size={14} weight="bold" className="p-1" aria-label="Remove filter" />
              </button>
            ))}
          </div>
        )}

        {!printers ? (
          gate
        ) : shown.length === 0 ? (
          <div className="browse-empty">
            <span
              aria-hidden="true"
              className="grid h-[72px] w-[72px] place-items-center rounded-card bg-sunken text-muted"
            >
              <MagnifyingGlass size={36} weight="duotone" />
            </span>
            {printers.length === 0 ? (
              <>
                <h3 className="mb-1 mt-3 font-display text-2xl font-extrabold text-ink">
                  Nobody has listed a printer yet
                </h3>
                <p className="m-0 mb-4 max-w-[40ch] text-muted">
                  Own one? Yours would be the first on the map.
                </p>
                <Link href="/dashboard/printers/new" className="btn btn-primary no-underline">
                  Add a printer
                </Link>
              </>
            ) : (
              <>
                <h3 className="mb-1 mt-3 font-display text-2xl font-extrabold text-ink">
                  No printers match all of those
                </h3>
                <p className="m-0 mb-4 max-w-[38ch] text-muted">
                  Show paused printers too, or allow PLA — most assistive parts print fine in
                  either.
                </p>
                <button type="button" onClick={() => setFilters({})} className="btn btn-primary">
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : (
          <ul className="browse-grid list-none p-0">
            {shown.map((p, i) => (
              <PrinterCard key={p.id} printer={p} tint={TINTS[i % TINTS.length]!} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PrinterCard({ printer: p, tint }: { printer: PrinterWithOwner; tint: string }) {
  const who = p.org_name ?? p.owner_name ?? 'A contributor'
  const open = isOpen(p)
  const where = [p.suburb, p.state].filter(Boolean).join(' ')
  const avail = !p.accepting
    ? { label: 'Not taking jobs', bg: 'var(--surface2)', Icon: MoonStars }
    : !open
      ? { label: 'Paused · full', bg: 'var(--tamber)', Icon: PauseCircle }
      : {
          label: p.open_jobs ? `Open · ${p.open_jobs} in queue` : 'Open · no queue',
          bg: 'var(--tok)',
          Icon: CheckCircle,
        }

  return (
    <li className={`printer-card ${open ? '' : 'opacity-55'}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="printer-card__ini" style={{ background: tint }}>
          {initials(who)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-extrabold leading-[1.3] text-ink [overflow-wrap:anywhere]">
            {who}
          </p>
          <p className="mt-0.5 text-[13px] font-bold leading-[1.45] text-muted">
            {p.owner_org_id ? (
              <Buildings className="mr-1 inline" aria-hidden="true" />
            ) : (
              <User className="mr-1 inline" aria-hidden="true" />
            )}
            {p.owner_org_id ? 'Organisation' : 'Person'}
            {where && (
              <>
                {' · '}
                <MapPin weight="fill" className="mr-0.5 inline text-apricot" aria-hidden="true" />
                {where}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className="printer-card__pill" style={{ background: avail.bg }}>
          <avail.Icon weight="fill" aria-hidden="true" />
          {avail.label}
        </span>
        {p.materials.length > 0 && (
          <span className="printer-card__pill bg-sunken">
            <Cube aria-hidden="true" />
            {p.materials.join(' · ')}
          </span>
        )}
      </div>

      <p className="text-[13px] text-muted">
        <PrinterIcon className="mr-1 inline" aria-hidden="true" />
        {p.name} · bed {p.bed_x} × {p.bed_y} × {p.bed_z} mm
      </p>
      {/* The figure a family sees before they ask (070). SPLAT records it and
          never moves it. */}
      <p className="text-[13px] font-bold text-ink">
        {p.filament_cents_per_g === null ? 'Free · parts only' : `About ${filamentRate(p.filament_cents_per_g)} filament, settled between you`}
      </p>

      {!open && (
        <p className="mt-auto flex min-h-11 items-center justify-center rounded-pill bg-sunken text-[13px] font-bold text-muted">
          Not taking requests right now
        </p>
      )}
    </li>
  )
}
