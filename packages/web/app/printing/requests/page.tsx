/**
 * Request a print.
 *
 * Starts from a guide — `?guide=<id>` — because the parts come from the guide
 * and never from an upload. Without one this is the printer directory plus the
 * door back to the library, which is honest about where a request begins rather
 * than offering a file picker that would break that rule.
 *
 * Was a ComingSoon placeholder until 058.
 */
import Link from 'next/link'
import { Printer as PrinterIcon } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { BackLink } from '@/components/back-link'
import {
  RequestPrintForm,
  printerAvailability,
  type PrintablePart,
} from '@/components/request-print-form'
import type { PrinterWithOwner } from '@splat-connect/types'

export const metadata = { title: 'Request a print — SPLAT Connect' }

type GuideWithFiles = { id: string; title: string; stl_files?: PrintablePart[] }

export default async function RequestAPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ guide?: string }>
}) {
  const { guide } = await searchParams
  const caps = await getCapabilities()

  const printers = caps
    ? await apiClient
        .get<PrinterWithOwner[]>('/api/printers')
        .catch(() => [] as PrinterWithOwner[])
    : []

  // A machine of the viewer's own is not a machine they can send a job to, and
  // the API says so too — filtering here keeps the list from offering a choice
  // that is refused on submit.
  const ledOrgIds = new Set(caps?.ledOrgs.map((org) => org.id) ?? [])
  const theirs = printers.filter(
    (p) => p.owner_id !== caps?.profile.id && !(p.owner_org_id && ledOrgIds.has(p.owner_org_id))
  )

  let tutorial: GuideWithFiles | null = null
  if (guide) {
    tutorial = await apiClient
      .get<GuideWithFiles>(`/api/public/tutorials/${guide}`)
      .catch(() => null)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/printing" label="3D printing" />
      <h1 className="mt-2 title-detail">Request a print</h1>
      <p className="mb-6 mt-2 text-sm leading-relaxed text-muted">
        Pick the parts of a guide you need and send them to one printer.
      </p>

      {!caps ? (
        <div className="card flex flex-col items-start gap-3 p-6">
          <p className="text-sm leading-relaxed text-ink">
            You need an account to send a request, so the printer knows who they are printing for.
          </p>
          <Link href="/signup" className="btn btn-primary no-underline">
            Create an account
          </Link>
        </div>
      ) : tutorial ? (
        <RequestPrintForm
          tutorialId={tutorial.id}
          tutorialTitle={tutorial.title}
          parts={tutorial.stl_files ?? []}
          printers={theirs}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="card flex flex-col items-start gap-3 p-6">
            <p className="text-sm leading-relaxed text-ink">
              Requests start from a guide — open the one you are building and ask for its parts from
              there.
            </p>
            <Link href="/library" className="btn btn-primary no-underline">
              Browse the guides
            </Link>
          </div>

          <section>
            <h2 className="title-section mb-3">Printers on the platform</h2>
            <ul className="flex list-none flex-col gap-2">
              {theirs.length === 0 && (
                <li className="text-sm leading-relaxed text-muted">
                  Nobody has listed a printer yet.
                </li>
              )}
              {theirs.map((printer) => {
                const unavailable = printerAvailability(printer)
                return (
                  <li
                    key={printer.id}
                    className="flex items-start gap-3 rounded-[var(--radius-panel)] bg-canvas p-4"
                  >
                    <span aria-hidden="true" className="empty-badge text-brand-deep">
                      <PrinterIcon size={22} weight="duotone" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-ink">
                        {printer.name} · {printer.org_name ?? printer.owner_name ?? 'A contributor'}
                      </span>
                      <span className="block text-sm text-muted">
                        {[
                          printer.materials.join(', '),
                          `${printer.bed_x}×${printer.bed_y}×${printer.bed_z} mm`,
                          [printer.suburb, printer.state].filter(Boolean).join(', ') || null,
                          unavailable,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
