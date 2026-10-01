/**
 * Printable parts — every STL file from an approved guide, searchable by
 * filename and guide title, each row linking to the guide it belongs to.
 *
 * The board draws this screen only as a "Not built yet" with three steps;
 * those steps stay, as the intro. Settings are the author's (068), so a row
 * shows what they tested rather than anything to choose.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { Cube, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import type { CataloguePage } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { formatPrintMinutes } from '@/lib/print-settings'
import { Pager } from '@/components/pager'

export const metadata = { title: 'Printable parts — SPLAT Connect' }

const STEPS = [
  'Search by what the part has to do, not by filename',
  'Check the tested filament and settings before you print',
  'Print it yourself, or send it to an association that will',
]

const EMPTY: CataloguePage = { items: [], page: 1, pages: 1, total: 0 }

export default async function PrintingPartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q = '', page } = await searchParams
  const query = new URLSearchParams({ ...(q ? { q } : {}), ...(page ? { page } : {}) }).toString()
  const list = await apiClient
    .get<CataloguePage>(`/api/public/printable-parts${query ? `?${query}` : ''}`)
    .catch(() => EMPTY)

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-6">
      <header>
        <p className="eyebrow text-muted">3D Printing</p>
        <h1 className="mb-2 mt-1 font-display text-[40px] font-extrabold leading-[1.1] text-ink">Printable parts</h1>
        <p className="max-w-[60ch] text-base leading-[1.55] text-muted">
          A catalogue of STL files for switch mounts, cases and interrupter housings — each one sized and print-tested
          rather than guessed at.
        </p>
        <ol className="mt-4 flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </header>

      <form role="search" action="/printing/parts" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search parts"
          className="field min-h-12 flex-1 font-semibold"
        />
        <button type="submit" className="btn btn-primary">
          <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
          Search
        </button>
      </form>

      {list.items.length === 0 ? (
        <p className="text-muted">
          {q ? `Nothing matches "${q}". Try a different word, or clear the search.` : 'No printable parts yet.'}
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-2.5 p-0">
          {list.items.map((p) => (
            <li key={p.id} className="print-part">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 flex-none place-items-center rounded-field bg-violet-soft text-[var(--tink)]"
              >
                <Cube size={24} weight="duotone" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono text-sm font-bold text-ink [overflow-wrap:anywhere]">{p.filename}</span>
                <Link href={`/tutorials/${p.tutorials.id}` as Route} className="text-sm font-bold text-brand-dark hover:underline">
                  {p.tutorials.title}
                </Link>
                <span className="text-[13px] text-muted">
                  {[
                    p.material,
                    p.filament_grams != null ? `${p.filament_grams} g` : null,
                    p.print_minutes != null ? formatPrintMinutes(p.print_minutes) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Pager page={list.page} pages={list.pages} params={{ q: q || undefined }} />
    </div>
  )
}
