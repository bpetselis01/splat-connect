/**
 * Find a printer — the 3D Printing pillar's front door.
 *
 * Was a hub of three tiles under a paragraph. The board makes it the browse
 * shape the Guides and Toy Library screens use: the hero ("You do not need a
 * printer", with "Own one? Print for a family nearby." as the give side), then
 * a filter rail beside the printers themselves. The headline is still the
 * promise the old hub led with — you do not need to own a printer.
 *
 * The directory reads /api/printers, which needs a session, so a guest gets the
 * board's sign-in gate over a blurred skeleton rather than an empty grid that
 * would read as "nobody prints here".
 *
 * Requests start from a guide (the parts come from its STL files, never an
 * upload), so this page browses; it does not send. The board's "pick up to
 * three, first to accept wins" happens on RequestAPrintPage, which is the one
 * place that knows which guide the parts come from.
 */
import Link from 'next/link'
import {
  Printer as PrinterIcon,
  Recycle,
  Plus,
  BookOpen,
  ArrowRight,
  LockSimple,
} from '@phosphor-icons/react/dist/ssr'
import type { PrinterWithOwner } from '@splat-connect/types'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { BrowseHero } from '@/components/browse-hero'
import { SplatMascot } from '@/components/splat-mascot'
import { PrinterDirectory } from '@/components/printer-directory'
import { printerAvailability } from '@/lib/printer-availability'

export const metadata = {
  title: '3D Printing — SPLAT Connect',
  description:
    'Printed switch mounts, cases and battery interrupters — find someone nearby to print one, or list your own printer.',
}

const SKELETON_TINTS = ['var(--tmint)', 'var(--tviolet)', 'var(--tamber)']

export default async function PrintingPage() {
  const caps = await getCapabilities()

  const printers = caps
    ? await apiClient.get<PrinterWithOwner[]>('/api/printers').catch(() => [] as PrinterWithOwner[])
    : []

  // The viewer's own machines are not somewhere they can send a job — the same
  // filter /printing/requests applies, so the two lists agree.
  const ledOrgIds = new Set(caps?.ledOrgs.map((org) => org.id) ?? [])
  const theirs = printers.filter(
    (p) => p.owner_id !== caps?.profile.id && !(p.owner_org_id && ledOrgIds.has(p.owner_org_id))
  )
  const openNow = theirs.filter((p) => printerAvailability(p) === null).length

  return (
    <div className="flex flex-col gap-6">
      <BrowseHero
        eyebrow="3D Printing"
        title="You do not need a printer"
        lede="Most assistive parts are small — a switch mount, an interrupter case — and someone nearby already owns a printer they would rather use for this. Pick up to three; the first to accept prints it, and you cover the filament."
        primary={{
          label: 'Find a printer',
          href: '#printer-grid',
          icon: <PrinterIcon size={20} weight="bold" aria-hidden="true" />,
        }}
        secondary={{
          label: 'Recycle plastic for credit',
          href: '/get-involved/recycling',
          icon: <Recycle size={20} weight="bold" className="text-brand-dark" aria-hidden="true" />,
        }}
        // Only the figure the API can back. The board's "parts printed" and
        // "days median turnaround" have no public source yet, and a guest
        // cannot read the printer list at all, so they see no numbers rather
        // than zeros.
        stats={caps ? [{ n: openNow, label: 'printers open now' }] : []}
        aside={{
          kicker: 'Or give',
          title: 'Own one? Print for a family nearby.',
          body: 'List your printer, set when you are open, accept only what suits your bed and filament. Pickup is your fixed point, and the family covers your filament — you are never out of pocket.',
          cta: {
            label: 'Add a printer',
            href: '/dashboard/printers/new',
            icon: <Plus size={18} weight="bold" aria-hidden="true" />,
          },
          art: <SplatMascot width={132} pose="hold" />,
          tint: 'var(--tviolet)',
        }}
      />

      <section id="printer-grid" aria-label="Find a printer" className="scroll-mt-24">
        {/* The board's no-guide banner: nothing here sends a request, and it
            says so before anybody looks for the button. */}
        <div className="printing-guide-first">
          <span aria-hidden="true" className="printing-guide-first__icon">
            <BookOpen size={34} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[22px] font-extrabold text-ink">
              Every request starts from a guide
            </p>
            <p className="mt-1.5 max-w-[64ch] text-[15px] leading-[1.55] text-ink">
              The printer gets the STL files and the tested settings straight from an approved
              assistive tech guide — nothing to upload, nothing to guess. Open a guide and press{' '}
              <strong>Request a print</strong> on its Files tab; come back here only to browse who
              is printing.
            </p>
          </div>
          <Link href="/library" className="btn btn-lg flex-none bg-ink text-surface no-underline">
            Find a guide first
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        <PrinterDirectory
          printers={caps ? theirs : null}
          gate={
            <div className="printing-gate">
              <div aria-hidden="true" className="printing-gate__skeleton">
                {SKELETON_TINTS.map((tint) => (
                  <div key={tint} className="printing-gate__card">
                    <span
                      className="h-[52px] w-[52px] rounded-[18px]"
                      style={{ background: tint }}
                    />
                    <span className="h-[18px] w-[70%] rounded-[14px] bg-line" />
                    <span className="h-[14px] w-1/2 rounded-[14px] bg-line" />
                    <span className="mt-auto h-[46px] rounded-pill bg-line" />
                  </div>
                ))}
              </div>
              <div className="printing-gate__over">
                <div className="flex max-w-[560px] flex-col items-center gap-4 text-center">
                  <span
                    aria-hidden="true"
                    className="grid h-16 w-16 place-items-center rounded-card bg-brand-tint text-brand-dark shadow-[var(--e2)]"
                  >
                    <LockSimple size={34} weight="duotone" />
                  </span>
                  <h2 className="font-display text-[30px] font-extrabold leading-[1.12] text-ink">
                    Sign in to ask for a print
                  </h2>
                  <p className="max-w-[46ch] text-base leading-[1.55] text-muted [text-wrap:pretty]">
                    Printers give their time free and you cover the filament. We ask you to sign in
                    so the person printing has a name to reply to, and so your suburb — never your
                    address — can be matched to a pickup point nearby.
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    <Link
                      href={`/login?next=${encodeURIComponent('/printing')}`}
                      className="btn btn-primary btn-lg no-underline"
                    >
                      Sign in to continue
                    </Link>
                    <Link href="/signup" className="btn btn-quiet no-underline">
                      Create a free account
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </section>
    </div>
  )
}
