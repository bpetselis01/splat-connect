/**
 * Request a print.
 *
 * Starts from a guide — `?guide=<id>` — because the parts come from the guide
 * and never from an upload. Without one this is the board's "every request
 * starts from a guide" banner — the directory itself lives at /printing — which
 * is honest about where a request begins rather than offering a file picker
 * that would break that rule.
 *
 * Was a ComingSoon placeholder until 058.
 */
import Link from 'next/link'
import { BookOpen, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { BackLink } from '@/components/back-link'
import { RequestPrintForm, type PrintablePart } from '@/components/request-print-form'
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
    ? await apiClient.get<PrinterWithOwner[]>('/api/printers').catch(() => [] as PrinterWithOwner[])
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

  const header = (
    <header>
      <p className="eyebrow text-muted">3D Printing</p>
      <h1 className="mb-2 mt-1 font-display text-[40px] font-extrabold leading-[1.1] text-ink">
        Request a print
      </h1>
      <p className="max-w-[60ch] text-base leading-[1.55] text-muted">
        {tutorial ? (
          <>
            Everything below comes from <strong className="text-ink">{tutorial.title}</strong>. Tick
            the parts you need, say what matters, and send one request to the printer you pick.
          </>
        ) : (
          'Pick the parts of a guide you need and send them to one printer.'
        )}
      </p>
    </header>
  )

  return (
    <div className="mx-auto max-w-[1180px]">
      <BackLink href="/printing" label="3D printing" />

      {caps && tutorial ? (
        <RequestPrintForm
          tutorialId={tutorial.id}
          tutorialTitle={tutorial.title}
          parts={tutorial.stl_files ?? []}
          printers={theirs}
          header={header}
          requesterSuburb={
            [caps.profile.pickup_suburb, caps.profile.pickup_state].filter(Boolean).join(' ') ||
            null
          }
        />
      ) : (
        <div className="flex flex-col gap-7">
          {header}
          {!caps ? (
            <div className="print-panel items-start">
              <p className="text-sm leading-relaxed text-ink">
                You need an account to send a request, so the printer knows who they are printing
                for.
              </p>
              <Link href="/signup" className="btn btn-primary no-underline">
                Create an account
              </Link>
            </div>
          ) : (
            // The board's no-guide banner, shared with /printing: the parts
            // come from a guide, so without one there is nothing to request.
            <div className="printing-guide-first">
              <span aria-hidden="true" className="printing-guide-first__icon">
                <BookOpen size={34} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[22px] font-extrabold text-ink">
                  Every request starts from a guide
                </p>
                <p className="mt-1.5 max-w-[64ch] text-[15px] leading-[1.55] text-ink">
                  The printer gets the STL files straight from an approved assistive tech guide —
                  nothing to upload, nothing to guess. Open a guide and press{' '}
                  <strong>Request a print</strong> on its Files tab.{' '}
                  <Link href="/printing" className="font-extrabold underline">
                    See who is printing →
                  </Link>
                </p>
              </div>
              <Link
                href="/library"
                className="btn btn-lg flex-none bg-ink text-surface no-underline"
              >
                Find a guide first
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
